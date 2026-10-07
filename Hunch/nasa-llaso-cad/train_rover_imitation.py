#!/usr/bin/env python3
"""
NASA HUNCH Lunar Rover - Imitation Learning (Behavioral Cloning) Trainer
Authors: Harshan & Team

Takes human driving demonstration datasets exported from the 3D WebGL simulator
and trains an End-to-End Neural Policy (CNN + Telemetry MLP) to predict
continuous steering and throttle at 60 FPS.
"""

import os
import glob
import json
import base64
import io
import math
from datetime import datetime
import numpy as np

try:
    from PIL import Image
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
except ImportError:
    print("\n[!] Missing PyTorch or Pillow.")
    print("    Install via: pip3 install torch torchvision pillow numpy\n")
    exit(1)

# Device: Apple Silicon GPU (mps), CUDA, or CPU
device = torch.device("mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu"))
print(f"[*] Training Device: {device}")

# =========================================================================
# 1. DATASET LOADER WITH SYMMETRY AUGMENTATION & BALANCING
# =========================================================================
class RoverDemonstrationDataset(Dataset):
    def __init__(self, json_path, img_size=(120, 160)):
        self.img_size = img_size
        self.samples = []

        with open(json_path, 'r') as f:
            data = json.load(f)
            raw_samples = data.get("samples", [])

        print(f"[*] Loaded {len(raw_samples)} raw demonstration frames from {os.path.basename(json_path)}")
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)

        turn_count = 0
        straight_count = 0
        reverse_count = 0

        for s in raw_samples:
            img_b64 = s.get("image")
            if not img_b64:
                continue

            steer = float(s.get("steer", 0.0))
            throttle = float(s.get("throttle", 0.0))
            goal_dist = float(s.get("goalDist", 0.0))
            goal_angle = float(s.get("goalAngle", 0.0))
            speed = float(s.get("speed", 0.0))
            sensors = s.get("sensors", [8.0, 8.0, 8.0])
            if len(sensors) < 3:
                sensors = [8.0, 8.0, 8.0]

            # Original sample
            self.samples.append({
                "image": img_b64,
                "flip": False,
                "steer": steer,
                "throttle": throttle,
                "goalDist": goal_dist,
                "goalAngle": goal_angle,
                "speed": speed,
                "sensors": [sensors[0], sensors[1], sensors[2]]
            })

            # Symmetrical augmentation (horizontal flip)
            if abs(steer) > 0.05 or abs(goal_angle) > 0.05:
                turn_count += 1
                self.samples.append({
                    "image": img_b64,
                    "flip": True,
                    "steer": -steer,
                    "throttle": throttle,
                    "goalDist": goal_dist,
                    "goalAngle": -goal_angle,
                    "speed": speed,
                    "sensors": [sensors[2], sensors[1], sensors[0]]  # Invert left/right ultrasonic
                })
                # If active steer, oversample to counterbalance straight-driving bias
                if abs(steer) > 0.2:
                    for _ in range(3):
                        self.samples.append({
                            "image": img_b64,
                            "flip": False,
                            "steer": steer,
                            "throttle": throttle,
                            "goalDist": goal_dist,
                            "goalAngle": goal_angle,
                            "speed": speed,
                            "sensors": [sensors[0], sensors[1], sensors[2]]
                        })
                        self.samples.append({
                            "image": img_b64,
                            "flip": True,
                            "steer": -steer,
                            "throttle": throttle,
                            "goalDist": goal_dist,
                            "goalAngle": -goal_angle,
                            "speed": speed,
                            "sensors": [sensors[2], sensors[1], sensors[0]]
                        })
            else:
                straight_count += 1

            # Proximity Reverse Reflex Training:
            # Whenever the rover is maneuvering near obstacles (sensors < 4.0 or active steer):
            if sensors[0] < 4.0 or sensors[2] < 4.0 or abs(steer) > 0.1:
                reverse_count += 2
                # In reverse, negative steer swings nose right, positive steer swings nose left
                is_left_closer = (sensors[0] <= sensors[2])
                rev_steer = -0.85 if is_left_closer else 0.85
                
                s_tight = [min(sensors[0], 0.9), 0.75, min(sensors[2], 2.4)] if is_left_closer else [min(sensors[0], 2.4), 0.75, min(sensors[2], 0.9)]
                s_tight_flip = [s_tight[2], s_tight[1], s_tight[0]]

                self.samples.append({
                    "image": img_b64,
                    "flip": False,
                    "steer": rev_steer,
                    "throttle": -0.85,  # BACK UP!
                    "goalDist": goal_dist,
                    "goalAngle": goal_angle,
                    "speed": speed,
                    "sensors": s_tight
                })
                self.samples.append({
                    "image": img_b64,
                    "flip": True,
                    "steer": -rev_steer,
                    "throttle": -0.85,  # BACK UP!
                    "goalDist": goal_dist,
                    "goalAngle": -goal_angle,
                    "speed": speed,
                    "sensors": s_tight_flip
                })

        print(f"[*] Processed {len(self.samples)} balanced training frames ({turn_count} turns, {reverse_count} reverse reflex, {straight_count} straight)")
        print(f"[*] Pre-decoding and caching {len(self.samples)} frames in memory for fast GPU training...")

        # Pre-cache into contiguous tensors
        N = len(self.samples)
        self.cached_imgs = np.zeros((N, 3, self.img_size[0], self.img_size[1]), dtype=np.float32)
        self.cached_telem = np.zeros((N, 6), dtype=np.float32)
        self.cached_actions = np.zeros((N, 2), dtype=np.float32)

        for i, item in enumerate(self.samples):
            img_bytes = base64.b64decode(item["image"])
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img = img.resize((self.img_size[1], self.img_size[0]))
            if item["flip"]:
                img = img.transpose(Image.FLIP_LEFT_RIGHT)

            img_arr = np.array(img, dtype=np.float32) / 255.0
            img_arr = (img_arr - self.mean) / self.std
            self.cached_imgs[i] = np.transpose(img_arr, (2, 0, 1))

            sensors = item["sensors"]
            self.cached_telem[i] = [
                item["goalDist"] / 50.0,
                item["goalAngle"] / math.pi,
                item["speed"] / 3.0,
                sensors[0] / 8.0,
                sensors[1] / 8.0,
                sensors[2] / 8.0
            ]
            self.cached_actions[i] = [item["steer"], item["throttle"]]

        print(f"[✓] Cache ready ({self.cached_imgs.nbytes / (1024*1024):.1f} MB in RAM).")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        return (
            torch.from_numpy(self.cached_imgs[idx]),
            torch.from_numpy(self.cached_telem[idx]),
            torch.from_numpy(self.cached_actions[idx])
        )

# =========================================================================
# 2. NEURAL NETWORK ARCHITECTURE
# =========================================================================
class RoverPilotNet(nn.Module):
    def __init__(self):
        super().__init__()
        # Visual Feature Extractor (MPS-Accelerated Hardware Backbone)
        self.conv = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.Conv2d(64, 128, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.Flatten()
        )
        # Deepened for Pothole/Pit/Hill camera detection
        # Visual feature dimension: 256 * 4 * 5 = 5120
        
        # Telemetry Fusion MLP (6 sensor/goal features)
        self.telem_mlp = nn.Sequential(
            nn.Linear(6, 32),
            nn.ReLU(),
            nn.Linear(32, 32),
            nn.ReLU()
        )

        # Decision Head (Fuses Vision + Telemetry -> [Steer, Throttle])
        self.head = nn.Sequential(
            nn.Linear(5120 + 32, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 2),
            nn.Tanh()  # Outputs bounded in [-1.0, +1.0]
        )

    def forward(self, img, telemetry):
        feat_img = self.conv(img)
        feat_telem = self.telem_mlp(telemetry)
        fused = torch.cat([feat_img, feat_telem], dim=1)
        return self.head(fused)

# =========================================================================
# 3. LOSS FUNCTION & TRAINING ROUTINE
# =========================================================================
class RoverLoss(nn.Module):
    def __init__(self, steer_weight=3.5, throttle_weight=1.0):
        super().__init__()
        self.steer_w = steer_weight
        self.throttle_w = throttle_weight
        self.mse = nn.MSELoss()

    def forward(self, preds, targets):
        # preds: (B, 2) [steer, throttle]
        steer_loss = self.mse(preds[:, 0], targets[:, 0])
        throttle_loss = self.mse(preds[:, 1], targets[:, 1])
        
        # Penalize diagonal drifting: If human target steer is high (avoiding edge), 
        # heavily penalize the model if it predicts a weak/straight steer.
        # This prevents the rover from lazily driving diagonally along edges.
        drift_penalty = torch.mean(torch.relu(torch.abs(targets[:, 0]) - 0.2) * torch.abs(targets[:, 0] - preds[:, 0]) ** 2)
        
        return self.steer_w * steer_loss + self.throttle_w * throttle_loss + (10.0 * drift_penalty)

def train(dataset_file, epochs=30, batch_size=16, lr=1e-3):
    dataset = RoverDemonstrationDataset(dataset_file)
    if len(dataset) < 10:
        print("[!] Dataset has fewer than 10 samples. Record at least 30 seconds of driving.")
        return

    # Train/Validation Split (85% / 15%)
    train_size = int(0.85 * len(dataset))
    val_size = len(dataset) - train_size
    train_set, val_set = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=batch_size, shuffle=False)

    model = RoverPilotNet().to(device)
    criterion = RoverLoss(steer_weight=3.5, throttle_weight=1.0)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    print(f"\n[+] Starting Imitation Learning Training ({epochs} Epochs on {device})...")
    best_val_loss = float('inf')
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for img, telem, act in train_loader:
            img, telem, act = img.to(device), telem.to(device), act.to(device)
            optimizer.zero_grad()
            preds = model(img, telem)
            loss = criterion(preds, act)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * img.size(0)

        train_loss = total_loss / len(train_set)
        scheduler.step()

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for img, telem, act in val_loader:
                img, telem, act = img.to(device), telem.to(device), act.to(device)
                preds = model(img, telem)
                val_loss += criterion(preds, act).item() * img.size(0)
        val_loss = val_loss / max(1, len(val_set))

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            # Save best checkpoint
            torch.save(model.state_dict(), "rover_pilot_best.pth")

        print(f"    Epoch {epoch:02d}/{epochs} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} (Best: {best_val_loss:.4f})")

    # Load best weights
    model.load_state_dict(torch.load("rover_pilot_best.pth", map_location=device))
    out_pth = "rover_pilot.pth"
    torch.save(model.state_dict(), out_pth)
    print(f"\n[✓] PyTorch model saved to {out_pth}")

    # Export to ONNX for 60 FPS Web Browser Inference
    # Note: Exporting on CPU guarantees clean ONNX opset 12 compatibility
    model.cpu()
    model.eval()
    dummy_img = torch.randn(1, 3, 120, 160)
    dummy_telem = torch.randn(1, 6)
    out_onnx = "rover_pilot.onnx"
    torch.onnx.export(
        model,
        (dummy_img, dummy_telem),
        out_onnx,
        input_names=["camera_image", "telemetry"],
        output_names=["steer_throttle"],
        opset_version=12
    )
    print(f"[✓] ONNX model exported to {out_onnx} ({os.path.getsize(out_onnx)/1024:.1f} KB)")
    manifest = {
        "version": datetime.utcnow().strftime("%Y.%m.%d.%H%M"),
        "onnx_file": out_onnx,
        "architecture": "RoverPilotNet",
        "dataset_frames": len(train_set) + len(val_set),
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "val_loss_best": round(float(best_val_loss), 5),
    }
    with open("policy_manifest.json", "w") as mf:
        json.dump(manifest, mf, indent=2)
    print("[✓] policy_manifest.json updated")
    print("[*] Ready for 60 FPS browser execution via onnxruntime-web!\n")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        target = sys.argv[1]
    else:
        downloads_path = os.path.expanduser("~/Downloads")
        candidates = (
            glob.glob("dataset_latest.json") +
            glob.glob(f"{downloads_path}/lunar_rover_driving_dataset_*.json") +
            glob.glob("lunar_rover_driving_dataset_*.json")
        )
        if not candidates:
            print("\n[!] No dataset found!")
            print("    1. Open http://localhost:8002/ in your browser.")
            print("    2. Click '🔴 REC FLIGHT' and drive with WASD for 1-2 minutes.")
            print("    3. Click '💾 EXPORT' to download the dataset.")
            print("    4. Run: python3 train_rover_imitation.py\n")
            sys.exit(1)
        target = sorted(candidates, key=os.path.getmtime)[-1]

    print(f"[*] Training on demonstration dataset: {target}")
    train(target, epochs=30)

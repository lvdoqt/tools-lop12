import cv2
import numpy as np
import base64
import io
from PIL import Image

def generate_synthetic_sheet():
    # Create 1000x1414 white canvas
    h, w = 1414, 1000
    img = np.ones((h, w, 3), dtype=np.uint8) * 255
    
    # Draw 4 corner markers: 7mm x 7mm -> ~33px x 33px
    # tl: top 3% (42px), left 4% (40px)
    # tr: top 3% (42px), right 4% (960px -> 927 to 960)
    # bl: bottom 3% (1371px), left 4% (40px)
    # br: bottom 3% (1371px), right 4% (960px)
    cv2.rectangle(img, (40, 42), (73, 75), (0, 0, 0), -1)
    cv2.rectangle(img, (927, 42), (960, 75), (0, 0, 0), -1)
    cv2.rectangle(img, (40, 1339), (73, 1372), (0, 0, 0), -1)
    cv2.rectangle(img, (927, 1339), (960, 1372), (0, 0, 0), -1)
    
    # Draw bubbles for 20 questions
    answers = ['A', 'B', 'C', 'D'] * 5
    for i in range(20):
        group = i // 30
        row = i % 30
        y = int(h * (0.245 + row * 0.0225))
        for opt_idx, opt in enumerate(['A', 'B', 'C', 'D']):
            x = int(w * (0.12 + opt_idx * 0.04 + group * 0.22))
            # draw empty bubble circle
            cv2.circle(img, (x, y), 10, (50, 50, 50), 1)
            cv2.putText(img, opt, (x - 4, y + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (80, 80, 80), 1)
            # if this is the chosen answer, fill it
            if opt == answers[i]:
                cv2.circle(img, (x, y), 8, (20, 20, 20), -1)
                
    return img, answers

if __name__ == '__main__':
    img, answers = generate_synthetic_sheet()
    print("Generated synthetic sheet shape:", img.shape)

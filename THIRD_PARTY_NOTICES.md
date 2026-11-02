# Third-party components

- **LGD Cards Gen 3** by TechTools / sroot — AGPL-3.0. The application uses the ONNX weights and exposes the complete browser inference source as `app.js`. Model, training configuration, metrics and source artifacts: https://huggingface.co/sroot/lgd-cards-gen3
- **ONNX Runtime Web** by Microsoft — MIT License, version 1.23.2. Source: https://github.com/microsoft/onnxruntime

The detector returns corner-pip boxes for all 52 rank/suit classes. This application keeps the highest-confidence corner for each unique card code, which removes the duplicate opposite corner of a fully visible card.

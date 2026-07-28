FROM python:3.10-slim

WORKDIR /code

# Install system dependencies for OpenCV and ONNX
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the app code
COPY ./ /code/

# Run the FastAPI app on port 7860 (Hugging Face default port)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]

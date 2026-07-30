import os
import subprocess
import shutil

os.makedirs('dummy_packages/opencv_python', exist_ok=True)
with open('dummy_packages/opencv_python/setup.py', 'w') as f:
    f.write('''from setuptools import setup

setup(
    name="opencv-python",
    version="99.9.9",
    description="Dummy",
    author="Dummy",
    packages=[],
)
''')

subprocess.run(["python", "setup.py", "bdist_wheel"], cwd='dummy_packages/opencv_python')

for file in os.listdir('dummy_packages/opencv_python/dist'):
    if file.endswith('.whl'):
        shutil.copy(os.path.join('dummy_packages/opencv_python/dist', file), 'wheels/')

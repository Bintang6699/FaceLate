import os

dirs = [
    'dummy_packages/scipy',
    'dummy_packages/scikit_learn',
    'dummy_packages/matplotlib',
    'dummy_packages/scikit_image'
]

for d in dirs:
    os.makedirs(d, exist_ok=True)
    name = d.split('/')[-1].replace('_', '-')
    with open(f'{d}/setup.py', 'w') as f:
        f.write(f"from setuptools import setup\nsetup(name='{name}', version='99.9.9')")

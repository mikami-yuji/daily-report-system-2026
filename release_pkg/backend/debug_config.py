import os
import json

# Check if config.json exists and what it contains
config_path = os.path.join(os.path.dirname(__file__), 'config.json')
print(f"Config path: {config_path}")
print(f"Config exists: {os.path.exists(config_path)}")

if os.path.exists(config_path):
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
        excel_dir = config.get('excel_dir', '../')
        print(f"Excel directory from config: {excel_dir}")
        print(f"Excel directory exists: {os.path.exists(excel_dir)}")
        
        if os.path.exists(excel_dir):
            print(f"\nFiles in directory:")
            try:
                files = [f for f in os.listdir(excel_dir) if f.endswith(('.xlsx', '.xlsm'))]
                for f in files:
                    print(f"  - {f}")
            except Exception as e:
                print(f"Error listing files: {e}")
else:
    print("Config file not found, using default '../'")

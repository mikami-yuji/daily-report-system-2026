try:
    import fastapi
    import uvicorn
    import openpyxl
    print("Dependencies found")
except ImportError as e:
    print(f"Missing dependency: {e}")

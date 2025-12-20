import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.dirname(__file__))

from main import search_design_images

def test_search():
    print("Testing search_design_images...")
    query = "117486" # From user log
    filename = "見上.xlsm" # Example based on user context
    
    try:
        result = search_design_images(query, filename)
        print("Result:", result)
    except Exception as e:
        print("Caught Exception:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_search()

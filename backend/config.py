import json
import os
from typing import List, Dict
from pydantic import BaseModel

SETTINGS_FILE = "settings.json"

class CustomColumn(BaseModel):
    name: str
    key: str # metadata key
    type: str = "text" # text, number, date

class Settings(BaseModel):
    custom_columns: List[CustomColumn] = []
    hidden_columns: List[str] = [] # List of column keys to hide
    column_order: List[str] = [] # List of column keys in order

def load_settings() -> Settings:
    if not os.path.exists(SETTINGS_FILE):
        return Settings()
    
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Settings(**data)
    except Exception as e:
        print(f"Error loading settings: {e}")
        return Settings()

def save_settings(settings: Settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            # indent=4 for readability if user inspects file
            json.dump(settings.dict(), f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving settings: {e}")

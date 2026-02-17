"""
Migrate data from Supabase to PocketBase.
Reads all tables from Supabase and inserts into PocketBase collections.
"""
import requests
import json
import sys
import time

# ---- Config ----
SUPABASE_URL = "https://yemivofvnbahqptxnqto.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWl2b2Z2bmJhaHFwdHhucXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjA5MjgsImV4cCI6MjA4NjQ5NjkyOH0.aDB-wtteHN7AibjPlc4TvADFZW2mam257vaxNQweCTk"
PB_URL = "http://127.0.0.1:8090"

# ---- Supabase helpers ----
SUPA_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def supa_fetch(table, limit=10000):
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit={limit}"
    r = requests.get(url, headers=SUPA_HEADERS)
    if r.status_code == 200:
        return r.json()
    else:
        print(f"  [ERROR] Supabase {table}: {r.status_code} - {r.text[:200]}")
        return []

# ---- Field mapping: Supabase column → PocketBase field ----
FIELD_MAP = {
    'farmers': {
        'ID card': 'ID_card',
        'Socioeconomic Status': 'Socioeconomic_Status',
        'Household Circumstances': 'Household_Circumstances',
        'Total Area registered': 'Total_Area_registered',
        'Number of coffee farm plots': 'Number_of_coffee_farm_plots',
        'Supported by': 'Supported_by',
        'Manage by': 'Manage_by',
        'Year of support': 'Year_of_support',
        'Supported Types': 'Supported_Types',
        'Participation Year': 'Participation_Year',
        'Staff input': 'Staff_input',
    },
    'plots': {
        'Area (ha)': 'Area_ha',
        'Land use rights certificate?': 'Land_use_rights_certificate',
        'Place name': 'Place_name',
        'Notes for details (Optional)': 'Notes_for_details',
        'Map Sheet': 'Map_Sheet',
        'Sub-mapsheet': 'Sub_mapsheet',
    },
    'yearly_data': {
        'Name of fertilizer': 'Name_of_fertilizer',
        'Fertilizer volume': 'Fertilizer_volume',
        'Fertilizer cost': 'Fertilizer_cost',
        'Name of Pesticides': 'Name_of_Pesticides',
        'Pesticides volume': 'Pesticides_volume',
        'Pesticides cost': 'Pesticides_cost',
        'Name of Herbicides': 'Name_of_Herbicides',
        'Herbicides volume': 'Herbicides_volume',
        'Herbicides cost': 'Herbicides_cost',
        'Shade_Trees_supported by': 'Shade_Trees_supported_by',
        'Year planted': 'Year_planted',
        'Survival Rate': 'Survival_Rate',
        'Fertiliser by WWF': 'Fertiliser_by_WWF',
        'Lime from SLOW': 'Lime_from_SLOW',
        'Cover Crop from SLOW (Yes/No)': 'Cover_Crop_from_SLOW',
        'Soil Test Support': 'Soil_Test_Support',
        'Attending training capacity organized by PFFP': 'Attending_training',
        'Cherry sales registered to Slow': 'Cherry_sales_registered_to_Slow',
        'Cherry sales supplied to Slow': 'Cherry_sales_supplied_to_Slow',
        'Revenue from cherry sales to Slow (VND)': 'Revenue_from_cherry_sales_to_Slow',
        'Cherry bought by Slow via processor': 'Cherry_Slow_thru_processor',
        'Update': 'Update_info',
    },
    'users': {
        'Staff ID': 'Staff_ID',
        'Full name': 'Full_name',
    },
    'op6_activities_list': {
        'OP6 ID': 'OP6_ID',
        'From date': 'From_date',
        'To date': 'To_date',
    },
    'species': {
        'Species type': 'Species_type',
        'Species Info': 'Species_Info',
    },
    'admin': {
        'Label EN': 'Label_EN',
        'Label VN': 'Label_VN',
    },
    'drop_values': {
        'ID': 'Code',
    }
}

# PocketBase collection names (Supabase table → PB collection)
PB_COLLECTION = {
    'farmers': 'farmers',
    'plots': 'plots',
    'yearly_data': 'yearly_data',
    'plot_yearly_support': 'plot_yearly_support',
    'users': 'app_users',
    'admin': 'admin',
    'drop_values': 'drop_values',
    'species': 'species',
    'training_list': 'training_list',
    'op6_activities_list': 'op6_activities_list',
}

def convert_record(table, record):
    """Convert Supabase record to PocketBase field names."""
    fmap = FIELD_MAP.get(table, {})
    out = {}
    for k, v in record.items():
        pb_key = fmap.get(k, k)
        # Skip null values
        if v is None:
            continue
        out[pb_key] = v
    return out

def pb_insert(collection, record):
    """Insert a single record into PocketBase."""
    r = requests.post(
        f"{PB_URL}/api/collections/{collection}/records",
        headers={"Content-Type": "application/json"},
        json=record
    )
    return r.status_code in (200, 204), r

# ---- Migration ----
TABLES = [
    'admin',           # No dependencies
    'drop_values',     # No dependencies
    'species',         # No dependencies
    'training_list',   # No dependencies
    'op6_activities_list',
    'users',
    'farmers',
    'plots',           # Depends on farmers
    'yearly_data',     # Depends on farmers
    'plot_yearly_support',  # Depends on plots
]

print("=" * 60)
print("PFFP Data Migration: Supabase -> PocketBase")
print("=" * 60)

total_ok = 0
total_fail = 0

for table in TABLES:
    collection = PB_COLLECTION[table]
    print(f"\n--- {table} -> {collection} ---")

    # Fetch from Supabase
    rows = supa_fetch(table)
    print(f"  Fetched {len(rows)} records from Supabase")

    if not rows:
        continue

    ok = 0
    fail = 0
    errors = []

    for i, row in enumerate(rows):
        pb_row = convert_record(table, row)
        success, resp = pb_insert(collection, pb_row)
        if success:
            ok += 1
        else:
            fail += 1
            if fail <= 3:  # Show first 3 errors per table
                errors.append(f"    Record {i}: {resp.status_code} - {resp.text[:150]}")

        # Progress indicator
        if (i + 1) % 50 == 0:
            print(f"  ... {i + 1}/{len(rows)}")

    print(f"  Result: {ok} OK, {fail} failed")
    for e in errors:
        print(e)

    total_ok += ok
    total_fail += fail

print(f"\n{'=' * 60}")
print(f"Migration complete: {total_ok} records OK, {total_fail} failed")
print(f"{'=' * 60}")

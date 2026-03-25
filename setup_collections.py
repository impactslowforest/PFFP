"""
PocketBase Collection Setup Script for PFFP
Creates all collections matching Supabase table structure.
PocketBase v0.36+ field format.
"""
import requests
import json
import sys

BASE = "http://127.0.0.1:8090"

# Authenticate
auth = requests.post(f"{BASE}/api/collections/_superusers/auth-with-password", json={
    "identity": "impact@slowforest.vn",
    "password": "Huongphung@452#"
})
if auth.status_code != 200:
    print("Auth failed:", auth.text)
    sys.exit(1)

TOKEN = auth.json()["token"]
HEADERS = {"Authorization": TOKEN, "Content-Type": "application/json"}

def create_collection(name, fields, id_field=None):
    # Check if exists and delete
    check_resp = requests.get(f"{BASE}/api/collections?filter=(name='{name}')", headers=HEADERS)
    if check_resp.status_code == 200 and check_resp.json()['items']:
        col_id = check_resp.json()['items'][0]['id']
        print(f"  Deleting existing collection {name} ({col_id})...")
        requests.delete(f"{BASE}/api/collections/{col_id}", headers=HEADERS)

    payload = {
        "name": name,
        "type": "base",
        "fields": fields,
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
        "deleteRule": ""
    }
    resp = requests.post(f"{BASE}/api/collections", json=payload, headers=HEADERS)
    if resp.status_code in (200, 201):
        print(f"  [OK] Created {name}")
        return True
    else:
        print(f"  [FAIL] {name}: {resp.text}")
        return False

def text(name, required=False, unique=False):
    f = {"name": name, "type": "text", "required": required}
    if unique:
        f["presentable"] = True
    return f

def number(name, required=False):
    return {"name": name, "type": "number", "required": required}

def email_field(name, required=False):
    return {"name": name, "type": "email", "required": required}

def date_field(name, required=False):
    return {"name": name, "type": "date", "required": required}

# ============================================================
# Collection definitions
# ============================================================

collections = {}

collections["farmers"] = [
    text("farmer_id", required=True, unique=True),
    text("full_name"),
    text("year_of_birth"),
    text("gender"),
    text("phone_number"),
    text("farmer_group_name"),
    text("cooperative_name"),
    text("village_name"),
    text("commune_name"),
    text("address"),
    text("id_card"),
    text("ethnicity"),
    text("socioeconomic_status"),
    text("household_circumstances"),
    number("num_household_members"),
    number("num_working_members"),
    number("total_coffee_area"),
    number("total_area_registered"),
    number("number_of_coffee_farm_plots"),
    text("supported_by"),
    text("manage_by"),
    text("year_of_support"),
    text("supported_types"),
    text("participation_year"),
    text("status"),
    text("activity"),
    text("staff_input"),
]

collections["plots"] = [
    text("plot_id", required=True, unique=True),
    text("farmer_id"),
    text("plot_name"),
    number("area_ha"),
    text("location"),
    text("land_use_rights_certificate"),
    text("border_natural_forest"),
    text("place_name"),
    number("num_shade_trees_before"),
    text("name_shade_trees_before"),
    number("num_coffee_trees"),
    text("coffee_planted_year"),
    text("notes_for_details"),
    text("map_sheet"),
    text("sub_mapsheet"),
    text("status"),
    text("activity"),
]

collections["yearly_data"] = [
    text("record_id", required=True, unique=True),
    text("farmer_id"),
    text("year"),
    number("annual_volume_cherry"),
    number("volume_high_quality"),
    number("total_coffee_income"),
    text("fertilizers_applied"),
    text("name_of_fertilizer"),
    number("fertilizer_volume"),
    number("fertilizer_cost"),
    text("pesticides_applied"),
    text("name_of_pesticides"),
    number("pesticides_volume"),
    number("pesticides_cost"),
    text("herbicides_applied"),
    text("name_of_herbicides"),
    number("herbicides_volume"),
    number("herbicides_cost"),
    number("hired_labor_costs"),
    number("other_costs"),
    text("shade_trees_supported_by"),
    number("number_shade_trees_planted"),
    text("shade_trees_species"),
    text("year_planted"),
    number("shade_trees_died"),
    number("survival_rate"),
    text("fertiliser_by_wwf"),
    text("lime_from_slow"),
    text("cover_crop_from_slow"),
    text("soil_test_support"),
    text("attending_training"),
    text("op6_activities"),
    number("cherry_sales_registered_to_slow"),
    number("cherry_sales_supplied_to_slow"),
    number("revenue_from_cherry_sales_to_slow"),
    number("cherry_slow_thru_processor"),
    text("update_info"),
    text("status"),
    text("activity"),
]

collections["support"] = [
    text("support_id", required=True, unique=True),
    text("plot_id"),
    text("year"),
    number("num_trees_received"),
    text("shade_trees_species"),
    number("num_trees_survived"),
    number("num_trees_died"),
    number("survival_rate"),
    text("supported_by"),
    number("num_shade_species"),
    text("registered_support"),
    text("notes"),
    text("status"),
    text("activity"),
]

collections["app_users"] = [
    text("staff_id", required=True, unique=True),
    text("full_name", required=True),
    text("organization"),
    text("position"),
    text("gender"),
    email_field("email"),
    text("phone"),
    text("password", required=True),
    text("authority"),
    text("role"),
    text("status"),
    text("view"),
    text("rule"),
]

collections["op6_activities_list"] = [
    text("op6_id", required=True, unique=True),
    text("name_en"),
    text("name_vi"),
    text("type"),
    text("from_date"),
    text("to_date"),
]

collections["species"] = [
    text("species_id", required=True, unique=True),
    text("species_name", required=True),
    text("species_type"),
    text("species_info"),
]

collections["admin"] = [
    text("adm_id", required=True, unique=True),
    text("condition", required=True),
    text("label_en"),
    text("label_vn"),
    text("notes"),
]

collections["training_list"] = [
    text("train_id", required=True, unique=True),
    text("name_en"),
    text("name_vi"),
]

collections["drop_values"] = [
    text("code", required=True, unique=True),
    text("condition", required=True),
    text("label"),
    text("label_en"),
    text("label_vn"),
]

# ============================================================
# Create all collections
# ============================================================
print("Creating PocketBase collections...")
print("=" * 50)

success = 0
fail = 0
for name, fields in collections.items():
    ok = create_collection(name, fields)
    if ok:
        success += 1
    else:
        fail += 1

print("=" * 50)
print(f"Done: {success} created, {fail} failed")

# ============================================================
# Add unique indexes for ID fields
# ============================================================
print("\nAdding unique indexes...")

index_map = {
    "farmers": "farmer_id",
    "plots": "plot_id",
    "yearly_data": "record_id",
    "support": "support_id",
    "app_users": "staff_id",
    "op6_activities_list": "op6_id",
    "species": "species_id",
    "admin": "adm_id",
    "training_list": "train_id",
    "drop_values": "code",
}

# Find collection IDs
resp = requests.get(f"{BASE}/api/collections?perPage=100", headers=HEADERS)
all_cols = {c['name']: c['id'] for c in resp.json()['items']}

for col_name, field_name in index_map.items():
    if col_name not in all_cols: continue
    col_id = all_cols[col_name]
    
    # Simple direct patch for index (PocketBase format)
    index_payload = {
        "indexes": [f"CREATE UNIQUE INDEX idx_{col_id}_unique_{field_name} ON {col_name} ({field_name})"]
    }
    r = requests.patch(f"{BASE}/api/collections/{col_id}", json=index_payload, headers=HEADERS)
    if r.status_code == 200:
        print(f"  [OK] {col_name}.{field_name} unique index")
    else:
        print(f"  [FAIL] {col_name}.{field_name} index: {r.text}")

print("Setup complete!")

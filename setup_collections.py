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
    """Create a base collection with given fields."""
    payload = {
        "name": name,
        "type": "base",
        "fields": fields,
        "indexes": []
    }
    resp = requests.post(f"{BASE}/api/collections", headers=HEADERS, json=payload)
    if resp.status_code in (200, 204):
        print(f"  [OK] {name}")
        return True
    else:
        print(f"  [FAIL] {name}: {resp.status_code} - {resp.text[:200]}")
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
# Field names: convert spaces -> underscores, keep close to original
# ============================================================

collections = {}

# 1. FARMERS
collections["farmers"] = [
    text("Farmer_ID", required=True, unique=True),
    text("Full_Name"),
    text("Year_Of_Birth"),
    text("Gender"),
    text("Phone_Number"),
    text("Farmer_Group_Name"),
    text("Cooperative_Name"),
    text("Village_Name"),
    text("Commune_Name"),
    text("Address"),
    text("ID_card"),
    text("Ethnicity"),
    text("Socioeconomic_Status"),
    text("Household_Circumstances"),
    number("Num_Household_Members"),
    number("Num_Working_Members"),
    number("Total_Coffee_Area"),
    number("Total_Area_registered"),
    number("Number_of_coffee_farm_plots"),
    text("Supported_by"),
    text("Manage_by"),
    text("Year_of_support"),
    text("Supported_Types"),
    text("Participation_Year"),
    text("Status"),
    text("Activity"),
    text("Staff_input"),
]

# 2. PLOTS
collections["plots"] = [
    text("Plot_Id", required=True, unique=True),
    text("Farmer_ID"),
    text("Plot_Name"),
    number("Area_ha"),
    text("Location"),
    text("Land_use_rights_certificate"),
    text("Border_Natural_Forest"),
    text("Place_name"),
    number("Num_Shade_Trees_Before"),
    text("Name_Shade_Trees_Before"),
    number("Num_Coffee_Trees"),
    text("Coffee_Planted_Year"),
    text("Notes_for_details"),
    text("Map_Sheet"),
    text("Sub_mapsheet"),
    text("Status"),
    text("Activity"),
]

# 3. YEARLY_DATA
collections["yearly_data"] = [
    text("Record_Id", required=True, unique=True),
    text("Farmer_ID"),
    text("Year"),
    number("Annual_Volume_Cherry"),
    number("Volume_High_Quality"),
    number("Total_Coffee_Income"),
    text("Fertilizers_Applied"),
    text("Name_of_fertilizer"),
    number("Fertilizer_volume"),
    number("Fertilizer_cost"),
    text("Pesticides_Applied"),
    text("Name_of_Pesticides"),
    number("Pesticides_volume"),
    number("Pesticides_cost"),
    text("Herbicides_Applied"),
    text("Name_of_Herbicides"),
    number("Herbicides_volume"),
    number("Herbicides_cost"),
    number("Hired_Labor_Costs"),
    number("Other_Costs"),
    text("Shade_Trees_supported_by"),
    number("Number_Shade_Trees_Planted"),
    text("Shade_Trees_Species"),
    text("Year_planted"),
    number("Shade_Trees_Died"),
    number("Survival_Rate"),
    text("Fertiliser_by_WWF"),
    text("Lime_from_SLOW"),
    text("Cover_Crop_from_SLOW"),
    text("Soil_Test_Support"),
    text("Attending_training"),
    text("Op6_Activities"),
    number("Cherry_sales_registered_to_Slow"),
    number("Cherry_sales_supplied_to_Slow"),
    number("Revenue_from_cherry_sales_to_Slow"),
    number("Cherry_Slow_thru_processor"),
    text("Update_info"),
    text("Status"),
    text("Activity"),
]

# 4. PLOT_YEARLY_SUPPORT
collections["plot_yearly_support"] = [
    text("Support_ID", required=True, unique=True),
    text("Plot_Id"),
    text("Year"),
    number("Num_Trees_Received"),
    text("Shade_Trees_Species"),
    number("Num_Trees_Survived"),
    number("Num_Trees_Died"),
    number("Survival_Rate"),
    text("Supported_By"),
    number("Num_Shade_Species"),
    text("Registered_Support"),
    text("Notes"),
    text("Status"),
    text("Activity"),
]

# 5. APP_USERS (renamed from "users" to avoid PocketBase built-in collision)
collections["app_users"] = [
    text("Staff_ID", required=True, unique=True),
    text("Full_name", required=True),
    text("Organization"),
    text("Position"),
    text("Gender"),
    email_field("Email"),
    text("Phone"),
    text("Password", required=True),
    text("Authority"),
    text("Role"),
    text("Status"),
    text("View"),
    text("Rule"),
]

# 6. OP6_ACTIVITIES_LIST
collections["op6_activities_list"] = [
    text("OP6_ID", required=True, unique=True),
    text("Name_EN"),
    text("Name_VI"),
    text("Type"),
    text("From_date"),
    text("To_date"),
]

# 7. SPECIES
collections["species"] = [
    text("Species_ID", required=True, unique=True),
    text("Species_name", required=True),
    text("Species_type"),
    text("Species_Info"),
]

# 8. ADMIN
collections["admin"] = [
    text("Adm_ID", required=True, unique=True),
    text("Condition", required=True),
    text("Label_EN"),
    text("Label_VN"),
    text("Notes"),
]

# 9. TRAINING_LIST
collections["training_list"] = [
    text("Train_ID", required=True, unique=True),
    text("Name_EN"),
    text("Name_VI"),
]

# 10. DROP_VALUES (dropdown values)
collections["drop_values"] = [
    text("Code", required=True, unique=True),
    text("Condition", required=True),
    text("Label"),
    text("Label_EN"),
    text("Label_VN"),
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
    "farmers": "Farmer_ID",
    "plots": "Plot_Id",
    "yearly_data": "Record_Id",
    "plot_yearly_support": "Support_ID",
    "app_users": "Staff_ID",
    "op6_activities_list": "OP6_ID",
    "species": "Species_ID",
    "admin": "Adm_ID",
    "training_list": "Train_ID",
    "drop_values": "Code",
}

# Get all collections to find their IDs
cols_resp = requests.get(f"{BASE}/api/collections", headers=HEADERS)
if cols_resp.status_code == 200:
    all_cols = cols_resp.json()
    # Handle both list and paginated response
    if isinstance(all_cols, list):
        col_list = all_cols
    else:
        col_list = all_cols.get("items", all_cols)

    for col in col_list:
        col_name = col.get("name", "")
        if col_name in index_map:
            field_name = index_map[col_name]
            idx_name = f"idx_unique_{col_name}_{field_name}"
            index_str = f"CREATE UNIQUE INDEX `{idx_name}` ON `{col_name}` (`{field_name}`)"

            # Update collection with index
            update_resp = requests.patch(
                f"{BASE}/api/collections/{col_name}",
                headers=HEADERS,
                json={"indexes": [index_str]}
            )
            if update_resp.status_code == 200:
                print(f"  [OK] {col_name}.{field_name} unique index")
            else:
                print(f"  [FAIL] {col_name}: {update_resp.status_code} - {update_resp.text[:200]}")

print("\nSetup complete!")

# ============================================================
# Print field name mapping (old Supabase -> new PocketBase)
# ============================================================
print("\n" + "=" * 50)
print("FIELD NAME MAPPING (Supabase -> PocketBase)")
print("=" * 50)

mapping = {
    "farmers": {
        "Farmer_ID": "Farmer_ID",
        "Full_Name": "Full_Name",
        "Year_Of_Birth": "Year_Of_Birth",
        "Gender": "Gender",
        "Phone_Number": "Phone_Number",
        "Farmer_Group_Name": "Farmer_Group_Name",
        "Cooperative_Name": "Cooperative_Name",
        "Village_Name": "Village_Name",
        "Commune_Name": "Commune_Name",
        "Address": "Address",
        "ID card": "ID_card",
        "Ethnicity": "Ethnicity",
        "Socioeconomic Status": "Socioeconomic_Status",
        "Household Circumstances": "Household_Circumstances",
        "Num_Household_Members": "Num_Household_Members",
        "Num_Working_Members": "Num_Working_Members",
        "Total_Coffee_Area": "Total_Coffee_Area",
        "Total Area registered": "Total_Area_registered",
        "Number of coffee farm plots": "Number_of_coffee_farm_plots",
        "Supported by": "Supported_by",
        "Manage by": "Manage_by",
        "Year of support": "Year_of_support",
        "Supported Types": "Supported_Types",
        "Participation Year": "Participation_Year",
        "Status": "Status",
        "Activity": "Activity",
        "Staff input": "Staff_input",
    },
    "plots": {
        "Plot_Id": "Plot_Id",
        "Farmer_ID": "Farmer_ID",
        "Plot_Name": "Plot_Name",
        "Area (ha)": "Area_ha",
        "Location": "Location",
        "Land use rights certificate?": "Land_use_rights_certificate",
        "Border_Natural_Forest": "Border_Natural_Forest",
        "Place name": "Place_name",
        "Num_Shade_Trees_Before": "Num_Shade_Trees_Before",
        "Name_Shade_Trees_Before": "Name_Shade_Trees_Before",
        "Num_Coffee_Trees": "Num_Coffee_Trees",
        "Coffee_Planted_Year": "Coffee_Planted_Year",
        "Notes for details (Optional)": "Notes_for_details",
        "Map Sheet": "Map_Sheet",
        "Sub-mapsheet": "Sub_mapsheet",
        "Status": "Status",
        "Activity": "Activity",
    },
    "yearly_data": {
        "Record_Id": "Record_Id",
        "Farmer_ID": "Farmer_ID",
        "Year": "Year",
        "Annual_Volume_Cherry": "Annual_Volume_Cherry",
        "Volume_High_Quality": "Volume_High_Quality",
        "Total_Coffee_Income": "Total_Coffee_Income",
        "Fertilizers_Applied": "Fertilizers_Applied",
        "Name of fertilizer": "Name_of_fertilizer",
        "Fertilizer volume": "Fertilizer_volume",
        "Fertilizer cost": "Fertilizer_cost",
        "Pesticides_Applied": "Pesticides_Applied",
        "Name of Pesticides": "Name_of_Pesticides",
        "Pesticides volume": "Pesticides_volume",
        "Pesticides cost": "Pesticides_cost",
        "Herbicides_Applied": "Herbicides_Applied",
        "Name of Herbicides": "Name_of_Herbicides",
        "Herbicides volume": "Herbicides_volume",
        "Herbicides cost": "Herbicides_cost",
        "Hired_Labor_Costs": "Hired_Labor_Costs",
        "Other_Costs": "Other_Costs",
        "Shade_Trees_supported by": "Shade_Trees_supported_by",
        "Number_Shade_Trees_Planted": "Number_Shade_Trees_Planted",
        "Shade_Trees_Species": "Shade_Trees_Species",
        "Year planted": "Year_planted",
        "Shade_Trees_Died": "Shade_Trees_Died",
        "Survival Rate": "Survival_Rate",
        "Fertiliser by WWF": "Fertiliser_by_WWF",
        "Lime from SLOW": "Lime_from_SLOW",
        "Cover Crop from SLOW (Yes/No)": "Cover_Crop_from_SLOW",
        "Soil Test Support": "Soil_Test_Support",
        "Attending training capacity organized by PFFP": "Attending_training",
        "Op6_Activities": "Op6_Activities",
        "Cherry sales registered to Slow": "Cherry_sales_registered_to_Slow",
        "Cherry sales supplied to Slow": "Cherry_sales_supplied_to_Slow",
        "Revenue from cherry sales to Slow (VND)": "Revenue_from_cherry_sales_to_Slow",
        "Cherry bought by Slow via processor": "Cherry_Slow_thru_processor",
        "Update": "Update_info",
        "Status": "Status",
        "Activity": "Activity",
    },
    "plot_yearly_support": {
        "Support_ID": "Support_ID",
        "Plot_Id": "Plot_Id",
        "Year": "Year",
        "Num_Trees_Received": "Num_Trees_Received",
        "Shade_Trees_Species": "Shade_Trees_Species",
        "Num_Trees_Survived": "Num_Trees_Survived",
        "Num_Trees_Died": "Num_Trees_Died",
        "Survival_Rate": "Survival_Rate",
        "Supported_By": "Supported_By",
        "Num_Shade_Species": "Num_Shade_Species",
        "Registered_Support": "Registered_Support",
        "Notes": "Notes",
        "Status": "Status",
        "Activity": "Activity",
    },
    "users": {
        "Staff ID": "Staff_ID",
        "Full name": "Full_name",
        "Organization": "Organization",
        "Position": "Position",
        "Gender": "Gender",
        "Email": "Email",
        "Phone": "Phone",
        "Password": "Password",
        "Authority": "Authority",
        "Role": "Role",
        "Status": "Status",
        "View": "View",
        "Rule": "Rule",
    },
    "op6_activities_list": {
        "OP6 ID": "OP6_ID",
        "Name_EN": "Name_EN",
        "Name_VI": "Name_VI",
        "Type": "Type",
        "From date": "From_date",
        "To date": "To_date",
    },
    "species": {
        "Species_ID": "Species_ID",
        "Species_name": "Species_name",
        "Species type": "Species_type",
        "Species Info": "Species_Info",
    },
    "admin": {
        "Adm_ID": "Adm_ID",
        "Condition": "Condition",
        "Label EN": "Label_EN",
        "Label VN": "Label_VN",
        "Notes": "Notes",
    },
    "training_list": {
        "Train_ID": "Train_ID",
        "Name_EN": "Name_EN",
        "Name_VI": "Name_VI",
    },
    "drop_values": {
        "ID": "Code",
        "Condition": "Condition",
        "Label": "Label",
        "Label_EN": "Label_EN",
        "Label_VN": "Label_VN",
    },
}

# Save mapping to JSON for frontend migration
with open(r"c:\Users\User\OneDrive - Slow Forest\Apps\PFFP\Cloude_PFFP_16Feb2026\field_mapping.json", "w", encoding="utf-8") as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)

print("\nField mapping saved to field_mapping.json")

for table, fields in mapping.items():
    changed = {k: v for k, v in fields.items() if k != v}
    if changed:
        print(f"\n{table}:")
        for old, new in changed.items():
            print(f"  '{old}' -> '{new}'")

"""
PFFP Data Import Script
Reads Excel file and imports data into PocketBase collections.
Clears existing data first, then imports in FK order.
"""
import sys, io, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
from openpyxl import load_workbook

PB_URL = "http://127.0.0.1:8090"
EXCEL_FILE = r"c:\Users\User\OneDrive - Slow Forest\Apps\PFFP\Cloude_PFFP_16Feb2026\Xu ly_PFFP_Main data_15Feb2026.xlsx"

# Excel header → PB field name mapping (only for headers that differ)
FIELD_MAP = {
    'Farmers': {
        'Participation Year': 'Participation_Year',
        'Year of support': 'Year_of_support',
        'ID card': 'ID_card',
        'Socioeconomic Status': 'Socioeconomic_Status',
        'Household Circumstances': 'Household_Circumstances',
        'Number of coffee farm plots': 'Number_of_coffee_farm_plots',
        'Supported by': 'Supported_by',
        'Manage by': 'Manage_by',
        'Supported Types': 'Supported_Types',
        'Number Farm registered for support from': 'Number_Farm_registered_for_support_from',
        'Total Area registered': 'Total_Area_registered',
        'Staff input': 'Staff_input',
    },
    'Plots': {
        'Area (ha)': 'Area_ha',
        'Land use rights certificate?': 'Land_use_rights_certificate',
        'Place name': 'Place_name',
        'Map Sheet': 'Map_Sheet',
        'Sub-mapsheet': 'Sub_mapsheet',
        'Receive seedlings from': 'Receive_seedlings_from',
        'Farm registered for support from': 'Farm_registered_for_support_from',
        'Notes for details (Optional)': 'Notes_for_details',
        'Number of shade trees': 'Number_of_shade_trees',
        'Number of shade tree species': 'Number_of_shade_tree_species',
    },
    'Yearly_Data': {
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
        'Fertiliser supported by WWF': 'Fertiliser_supported_by_WWF',
        'Lime supported by Slow': 'Lime_supported_by_Slow',
        'Cover crop supported by Slow (yes/no)': 'Cover_crop_supported_by_Slow',
        'Attending training capacity organized by PFFP': 'Attending_training_capacity_organized_by_PFFP',
        'Cherry sales registered to Slow': 'Cherry_sales_registered_to_Slow',
        'Cherry sales supplied to Slow': 'Cherry_sales_supplied_to_Slow',
        'Revenue from cherry sales to Slow (VND)': 'Revenue_from_cherry_sales_to_Slow',
        'Cherry bought by Slow via processor': 'Cherry_bought_by_Slow_thru_processor',
    },
    'Supported': {
        'Farmer ID': 'Farmer_ID',
        'Support code': 'Support_code',
        'A live': 'A_live',
        'Supported by': 'Supported_by',
        'Suppoted year': 'Supported_year',
    }
}

# Collections to process in order (FK dependency)
COLLECTIONS = [
    ('Farmers',     'farmers',      'Farmer_ID'),
    ('Plots',       'plots',        'Plot_Id'),
    ('Yearly_Data', 'yearly_data',  'Record_Id'),
    ('Supported',   'supported',    'Support_ID'),
]

def delete_all_records(collection):
    """Delete all records from a collection (paginated)."""
    total_deleted = 0
    while True:
        resp = requests.get(f"{PB_URL}/api/collections/{collection}/records?perPage=200&fields=id")
        data = resp.json()
        items = data.get('items', [])
        if not items:
            break
        for item in items:
            r = requests.delete(f"{PB_URL}/api/collections/{collection}/records/{item['id']}")
            if r.status_code in (200, 204):
                total_deleted += 1
            else:
                print(f"  WARN: Failed to delete {item['id']}: {r.status_code}")
    return total_deleted

def read_sheet(wb, sheet_name, field_map):
    """Read a sheet and return list of dicts with PB field names."""
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(min_row=1, values_only=False))
    if not rows:
        return []

    headers = [cell.value for cell in rows[0]]
    records = []

    for row in rows[1:]:
        values = [cell.value for cell in row]
        record = {}
        for header, value in zip(headers, values):
            if header is None:
                continue
            # Map Excel header to PB field name
            pb_field = field_map.get(header, header)
            # Convert value to string for text fields, keep numbers
            if value is None:
                record[pb_field] = ""
            elif isinstance(value, (int, float)):
                # Keep numeric for number fields
                record[pb_field] = value
            else:
                record[pb_field] = str(value).strip()
        records.append(record)

    return records

def import_records(collection, records, pk_field):
    """Import records into a PocketBase collection."""
    success = 0
    errors = 0
    for i, record in enumerate(records):
        try:
            resp = requests.post(
                f"{PB_URL}/api/collections/{collection}/records",
                json=record,
                headers={"Content-Type": "application/json"}
            )
            if resp.status_code in (200, 201):
                success += 1
            else:
                errors += 1
                if errors <= 3:  # Show first 3 errors
                    print(f"  ERR [{resp.status_code}]: {record.get(pk_field, '?')} - {resp.text[:200]}")
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"  EXCEPTION: {e}")

        # Progress
        if (i + 1) % 500 == 0:
            print(f"  ... {i+1}/{len(records)} (ok={success}, err={errors})")

    return success, errors

def main():
    print("=" * 60)
    print("PFFP Data Import")
    print("=" * 60)

    # Check PB health
    try:
        resp = requests.get(f"{PB_URL}/api/health")
        if resp.status_code != 200:
            print(f"ERROR: PocketBase not healthy: {resp.status_code}")
            return
    except:
        print("ERROR: Cannot connect to PocketBase")
        return

    print(f"PocketBase OK at {PB_URL}")

    # Load Excel
    print(f"\nLoading Excel: {EXCEL_FILE}")
    wb = load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    print(f"Sheets: {wb.sheetnames}")

    # Step 1: Clear existing data (reverse FK order)
    print("\n--- CLEARING EXISTING DATA ---")
    for sheet_name, collection, pk in reversed(COLLECTIONS[:3]):  # Only clear farmers/plots/yearly
        print(f"Clearing {collection}...")
        deleted = delete_all_records(collection)
        print(f"  Deleted {deleted} records")

    # Step 2: Import data
    print("\n--- IMPORTING DATA ---")
    for sheet_name, collection, pk in COLLECTIONS:
        print(f"\nImporting {sheet_name} → {collection}")
        field_map = FIELD_MAP.get(sheet_name, {})
        records = read_sheet(wb, sheet_name, field_map)
        print(f"  Read {len(records)} records from Excel")

        success, errors = import_records(collection, records, pk)
        print(f"  Result: {success} imported, {errors} errors")

    # Step 3: Verify counts
    print("\n--- VERIFICATION ---")
    for sheet_name, collection, pk in COLLECTIONS:
        resp = requests.get(f"{PB_URL}/api/collections/{collection}/records?perPage=1")
        data = resp.json()
        print(f"  {collection}: {data.get('totalItems', '?')} records")

    wb.close()
    print("\nDone!")

if __name__ == "__main__":
    main()

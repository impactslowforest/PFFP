/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ============================================================
  // 1. Create farmer_year collection
  // ============================================================
  const farmerYear = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000080",
        "max": 0,
        "min": 0,
        "name": "Enrollment_ID",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000081",
        "max": 0,
        "min": 0,
        "name": "Farmer_ID",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000082",
        "max": 0,
        "min": 0,
        "name": "Year",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000083",
        "max": 0,
        "min": 0,
        "name": "Program",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000084",
        "max": 0,
        "min": 0,
        "name": "Status",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000085",
        "max": 0,
        "min": 0,
        "name": "SLO_Classification",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_1900000080",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_farmer_year_enrollment_id` ON `farmer_year` (`Enrollment_ID`)"
    ],
    "listRule": "",
    "viewRule": "",
    "name": "farmer_year",
    "system": false,
    "type": "base",
    "updateRule": ""
  })

  app.save(farmerYear)

  // ============================================================
  // 2. Delete old supported collection and recreate with new structure
  // ============================================================
  try {
    const oldSupported = app.findCollectionByNameOrId("supported")
    app.delete(oldSupported)
  } catch(e) {
    // Collection may not exist
  }

  const supported = new Collection({
    "createRule": "",
    "deleteRule": "",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000090",
        "max": 0,
        "min": 0,
        "name": "Support_ID",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000091",
        "max": 0,
        "min": 0,
        "name": "Farmer_ID",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000092",
        "max": 0,
        "min": 0,
        "name": "Plot_ID",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000093",
        "max": 0,
        "min": 0,
        "name": "Year",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000094",
        "max": 0,
        "min": 0,
        "name": "Program",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000095",
        "max": 0,
        "min": 0,
        "name": "Support_Type",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000096",
        "max": 0,
        "min": 0,
        "name": "Support_Detail",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000097",
        "max": 0,
        "min": 0,
        "name": "Species_Code",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000098",
        "max": 0,
        "min": 0,
        "name": "Species_Name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number1900000099",
        "max": null,
        "min": null,
        "name": "Quantity",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000100",
        "max": 0,
        "min": 0,
        "name": "Unit",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_1900000090",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_supported_id` ON `supported` (`Support_ID`)"
    ],
    "listRule": "",
    "viewRule": "",
    "name": "supported",
    "system": false,
    "type": "base",
    "updateRule": ""
  })

  app.save(supported)

}, (app) => {
  // Rollback: remove farmer_year
  try {
    const c = app.findCollectionByNameOrId("farmer_year")
    app.delete(c)
  } catch(e) {}

  // Note: rollback of supported recreation is complex - old data is lost
  // Would need to recreate old schema manually if needed
})

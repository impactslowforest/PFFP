/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ============================================================
  // 1. Add new fields to supported collection (for new Support sheet)
  // ============================================================
  const supported = app.findCollectionByNameOrId("supported")

  // Add Plot_ID field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000060",
    "max": 0,
    "min": 0,
    "name": "Plot_ID",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Species_Code field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000061",
    "max": 0,
    "min": 0,
    "name": "Species_Code",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Species_Name field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000062",
    "max": 0,
    "min": 0,
    "name": "Species_Name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Year field (separate from Supported_year for backward compat)
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000063",
    "max": 0,
    "min": 0,
    "name": "Year",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Program field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000064",
    "max": 0,
    "min": 0,
    "name": "Program",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Support_Type field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000065",
    "max": 0,
    "min": 0,
    "name": "Support_Type",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Add Support_Detail field
  supported.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000066",
    "max": 0,
    "min": 0,
    "name": "Support_Detail",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // Set all rules to public
  supported.listRule = ""
  supported.viewRule = ""
  supported.createRule = ""
  supported.updateRule = ""
  supported.deleteRule = ""

  app.save(supported)

  // ============================================================
  // 2. Create survival_check collection
  // ============================================================
  const survivalCheck = new Collection({
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
        "id": "text1900000070",
        "max": 0,
        "min": 0,
        "name": "Check_ID",
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
        "id": "text1900000071",
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
        "id": "text1900000072",
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
        "id": "text1900000073",
        "max": 0,
        "min": 0,
        "name": "Check_Round",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number1900000074",
        "max": null,
        "min": null,
        "name": "Trees_Alive",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number1900000075",
        "max": null,
        "min": null,
        "name": "Survival_Rate",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_1900000070",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_survival_check_id` ON `survival_check` (`Check_ID`)"
    ],
    "listRule": "",
    "viewRule": "",
    "name": "survival_check",
    "system": false,
    "type": "base",
    "updateRule": ""
  })

  app.save(survivalCheck)

}, (app) => {
  // Rollback: remove survival_check collection
  try {
    const c = app.findCollectionByNameOrId("survival_check")
    app.delete(c)
  } catch(e) {}

  // Rollback: remove new fields from supported
  try {
    const supported = app.findCollectionByNameOrId("supported")
    supported.fields.removeById("text1900000060") // Plot_ID
    supported.fields.removeById("text1900000061") // Species_Code
    supported.fields.removeById("text1900000062") // Species_Name
    supported.fields.removeById("text1900000063") // Year
    supported.fields.removeById("text1900000064") // Program
    supported.fields.removeById("text1900000065") // Support_Type
    supported.fields.removeById("text1900000066") // Support_Detail
    app.save(supported)
  } catch(e) {}
})

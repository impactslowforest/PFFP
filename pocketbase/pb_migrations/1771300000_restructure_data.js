/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ============================================================
  // 1a. Delete plot_yearly_support collection
  // ============================================================
  try {
    const pys = app.findCollectionByNameOrId("plot_yearly_support")
    app.delete(pys)
  } catch (e) {
    // Collection may not exist, skip
  }

  // ============================================================
  // 1b. Add new field to farmers
  // ============================================================
  const farmers = app.findCollectionByNameOrId("pbc_4155943932")
  farmers.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000001",
    "max": 0,
    "min": 0,
    "name": "Number_Farm_registered_for_support_from",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  app.save(farmers)

  // ============================================================
  // 1c. Add new fields to plots
  // ============================================================
  const plots = app.findCollectionByNameOrId("pbc_1150480875")
  plots.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000010",
    "max": 0,
    "min": 0,
    "name": "Receive_seedlings_from",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  plots.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000011",
    "max": 0,
    "min": 0,
    "name": "Farm_registered_for_support_from",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  plots.fields.add(new Field({
    "hidden": false,
    "id": "number1900000012",
    "max": null,
    "min": null,
    "name": "Number_of_shade_trees",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))
  plots.fields.add(new Field({
    "hidden": false,
    "id": "number1900000013",
    "max": null,
    "min": null,
    "name": "Number_of_shade_tree_species",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))
  app.save(plots)

  // ============================================================
  // 1d. Modify yearly_data fields (rename + add + remove)
  //     Since all data will be cleared and reimported, we remove
  //     old fields and add new ones. Field IDs change but that's OK.
  // ============================================================
  const yearly = app.findCollectionByNameOrId("pbc_3665116205")

  // Remove fields to be renamed/deleted
  yearly.fields.removeById("number1981138349") // Survival_Rate
  yearly.fields.removeById("text3011489002")   // Fertiliser_by_WWF
  yearly.fields.removeById("text2096959696")   // Lime_from_SLOW
  yearly.fields.removeById("text3835259575")   // Cover_Crop_from_SLOW
  yearly.fields.removeById("text1327735048")   // Attending_training
  yearly.fields.removeById("number3080701822") // Cherry_Slow_thru_processor
  yearly.fields.removeById("text2574903583")   // Update_info (deleted)

  // Add renamed fields with new names
  yearly.fields.add(new Field({
    "hidden": false,
    "id": "number1900000020",
    "max": null,
    "min": null,
    "name": "Survival",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))
  yearly.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000021",
    "max": 0,
    "min": 0,
    "name": "Fertiliser_supported_by_WWF",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  yearly.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000022",
    "max": 0,
    "min": 0,
    "name": "Lime_supported_by_Slow",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  yearly.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000023",
    "max": 0,
    "min": 0,
    "name": "Cover_crop_supported_by_Slow",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  yearly.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000024",
    "max": 0,
    "min": 0,
    "name": "Attending_training_capacity_organized_by_PFFP",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))
  yearly.fields.add(new Field({
    "hidden": false,
    "id": "number1900000025",
    "max": null,
    "min": null,
    "name": "Cherry_bought_by_Slow_thru_processor",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // Add new Date field
  yearly.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1900000026",
    "max": 0,
    "min": 0,
    "name": "Date",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  app.save(yearly)

  // ============================================================
  // 1e. Create supported collection
  // ============================================================
  const supported = new Collection({
    "createRule": null,
    "deleteRule": null,
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
        "id": "text1900000030",
        "max": 0,
        "min": 0,
        "name": "Farmer_ID",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1900000031",
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
        "id": "text1900000032",
        "max": 0,
        "min": 0,
        "name": "Support_code",
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
        "id": "text1900000033",
        "max": 0,
        "min": 0,
        "name": "Date",
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
        "id": "text1900000034",
        "max": 0,
        "min": 0,
        "name": "Item_Detail",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number1900000035",
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
        "id": "text1900000036",
        "max": 0,
        "min": 0,
        "name": "Unit",
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
        "id": "text1900000037",
        "max": 0,
        "min": 0,
        "name": "Note",
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
        "id": "text1900000038",
        "max": 0,
        "min": 0,
        "name": "Staff_Input",
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
        "id": "text1900000039",
        "max": 0,
        "min": 0,
        "name": "A_live",
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
        "id": "text1900000040",
        "max": 0,
        "min": 0,
        "name": "Supported_by",
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
        "id": "text1900000041",
        "max": 0,
        "min": 0,
        "name": "Supported_year",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_1900000050",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_supported_Support_ID` ON `supported` (`Support_ID`)"
    ],
    "listRule": null,
    "name": "supported",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  })

  return app.save(supported)
}, (app) => {
  // Rollback: delete supported, restore plot_yearly_support would be complex
  // This is a one-way migration
  try {
    const supported = app.findCollectionByNameOrId("supported")
    app.delete(supported)
  } catch (e) {}
})

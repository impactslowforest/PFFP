/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3665116205")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_yearly_data_Record_Id` ON `yearly_data` (`Record_Id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3665116205")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})

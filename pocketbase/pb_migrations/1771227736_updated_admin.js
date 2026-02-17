/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1128838045")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_admin_Adm_ID` ON `admin` (`Adm_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1128838045")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})

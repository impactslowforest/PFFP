/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3037023628")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_op6_activities_list_OP6_ID` ON `op6_activities_list` (`OP6_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3037023628")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})

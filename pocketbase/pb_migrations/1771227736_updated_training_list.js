/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2724626986")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_training_list_Train_ID` ON `training_list` (`Train_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2724626986")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})

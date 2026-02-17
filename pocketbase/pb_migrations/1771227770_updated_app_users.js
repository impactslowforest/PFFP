/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2793131708")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_unique_app_users_Staff_ID` ON `app_users` (`Staff_ID`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2793131708")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})

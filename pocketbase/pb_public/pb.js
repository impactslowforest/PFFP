/**
 * PocketBase API Wrapper for PFFP
 * Provides Supabase-compatible API interface over PocketBase REST.
 * Drop-in replacement: script.js calls supabaseClient.from(...) methods unchanged.
 */
var PB_URL = window.location.origin || "http://127.0.0.1:8090";

// ---- Table name mapping (Supabase table → PocketBase collection) ----
var PB_TABLE_MAP = {
    'users': 'app_users',       // PB built-in 'users' is auth collection
    'farmers': 'farmers',
    'plots': 'plots',
    'yearly_data': 'yearly_data',
    'supported': 'supported',
    'admin': 'admin',
    'drop_values': 'drop_values',
    'species': 'species',
    'training_list': 'training_list',
    'op6_activities_list': 'op6_activities_list'
};

// ---- Field name mapping: Supabase column → PocketBase field ----
// Only fields that changed name (spaces→underscores, reserved words)
var PB_FIELD_MAP = {
    'farmers': {
        'ID card': 'ID_card',
        'Socioeconomic Status': 'Socioeconomic_Status',
        'Household Circumstances': 'Household_Circumstances',
        'Total Area registered': 'Total_Area_registered',
        'Number of coffee farm plots': 'Number_of_coffee_farm_plots',
        'Supported by': 'Supported_by',
        'Manage by': 'Manage_by',
        'Year of support': 'Year_of_support',
        'Supported Types': 'Supported_Types',
        'Participation Year': 'Participation_Year',
        'Staff input': 'Staff_input',
        'Number Farm registered for support from': 'Number_Farm_registered_for_support_from'
    },
    'plots': {
        'Area (ha)': 'Area_ha',
        'Land use rights certificate?': 'Land_use_rights_certificate',
        'Place name': 'Place_name',
        'Notes for details (Optional)': 'Notes_for_details',
        'Map Sheet': 'Map_Sheet',
        'Sub-mapsheet': 'Sub_mapsheet',
        'Receive seedlings from': 'Receive_seedlings_from',
        'Farm registered for support from': 'Farm_registered_for_support_from',
        'Number of shade trees': 'Number_of_shade_trees',
        'Number of shade tree species': 'Number_of_shade_tree_species'
    },
    'yearly_data': {
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
        'Cover crop supported by Slow': 'Cover_crop_supported_by_Slow',
        'Soil Test Support': 'Soil_Test_Support',
        'Attending training capacity organized by PFFP': 'Attending_training_capacity_organized_by_PFFP',
        'Cherry sales registered to Slow': 'Cherry_sales_registered_to_Slow',
        'Cherry sales supplied to Slow': 'Cherry_sales_supplied_to_Slow',
        'Revenue from cherry sales to Slow (VND)': 'Revenue_from_cherry_sales_to_Slow',
        'Cherry bought by Slow via processor': 'Cherry_bought_by_Slow_thru_processor'
    },
    'users': {
        'Staff ID': 'Staff_ID',
        'Full name': 'Full_name'
    },
    'op6_activities_list': {
        'OP6 ID': 'OP6_ID',
        'From date': 'From_date',
        'To date': 'To_date'
    },
    'species': {
        'Species type': 'Species_type',
        'Species Info': 'Species_Info'
    },
    'admin': {
        'Label EN': 'Label_EN',
        'Label VN': 'Label_VN'
    },
    'supported': {
        'Farmer ID': 'Farmer_ID',
        'Support code': 'Support_code',
        'A live': 'A_live',
        'Supported by': 'Supported_by',
        'Supported year': 'Supported_year'
    },
    'drop_values': {
        'ID': 'Code'
    }
};

// Build reverse maps (PB field → Supabase column) for each table
var PB_REVERSE_MAP = {};
Object.keys(PB_FIELD_MAP).forEach(function (table) {
    PB_REVERSE_MAP[table] = {};
    var m = PB_FIELD_MAP[table];
    Object.keys(m).forEach(function (supaKey) {
        PB_REVERSE_MAP[table][m[supaKey]] = supaKey;
    });
});

// ---- ID column mapping (Supabase idCol → PB field name) ----
var PB_ID_COL_MAP = {
    'Staff ID': 'Staff_ID',
    'OP6 ID': 'OP6_ID',
    'ID': 'Code'
};

// ---- Helpers ----
function pbCollection(supaTable) {
    return PB_TABLE_MAP[supaTable] || supaTable;
}

function supaToDb(table, record) {
    var map = PB_FIELD_MAP[table];
    if (!map) return Object.assign({}, record);
    var out = {};
    Object.keys(record).forEach(function (k) {
        var pbKey = map[k] || k;
        out[pbKey] = record[k];
    });
    return out;
}

function pbToSupa(table, record) {
    var rmap = PB_REVERSE_MAP[table];
    if (!rmap) {
        var clean = {};
        Object.keys(record).forEach(function (k) {
            if (k !== 'id' && k !== 'created' && k !== 'updated' && k !== 'collectionId' && k !== 'collectionName') {
                clean[k] = record[k];
            }
        });
        return clean;
    }
    var out = {};
    Object.keys(record).forEach(function (k) {
        if (k === 'id' || k === 'created' || k === 'updated' || k === 'collectionId' || k === 'collectionName') return;
        var supaKey = rmap[k] || k;
        out[supaKey] = record[k];
    });
    return out;
}

function pbIdCol(supaTable, supaIdCol) {
    return PB_ID_COL_MAP[supaIdCol] || supaIdCol;
}

// Fetch all records from a PocketBase collection (handles pagination)
function pbFetchAll(collection, limit) {
    var perPage = Math.min(limit || 10000, 500);
    var allItems = [];
    function fetchPage(page) {
        return fetch(PB_URL + '/api/collections/' + collection + '/records?page=' + page + '&perPage=' + perPage + '&skipTotal=false')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.items) {
                    allItems = allItems.concat(data.items);
                    if (data.page < data.totalPages) {
                        return fetchPage(page + 1);
                    }
                }
                return allItems;
            });
    }
    return fetchPage(1);
}

// Find PB internal id by custom ID field value
function pbFindByField(collection, fieldName, fieldValue) {
    var filter = encodeURIComponent(fieldName + '="' + String(fieldValue).replace(/"/g, '\\"') + '"');
    return fetch(PB_URL + '/api/collections/' + collection + '/records?filter=' + filter + '&perPage=1')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            return (data.items && data.items.length > 0) ? data.items[0] : null;
        });
}

// ---- Supabase-compatible Client ----
var supabaseClient = {
    from: function (tableName) {
        var collection = pbCollection(tableName);
        var supaTable = tableName;

        return {
            // SELECT
            select: function (cols) {
                var _limit = 10000;
                var builder = {
                    limit: function (n) { _limit = n; return builder; },
                    then: function (resolve, reject) {
                        return pbFetchAll(collection, _limit)
                            .then(function (items) {
                                var converted = items.map(function (item) { return pbToSupa(supaTable, item); });
                                resolve({ data: converted, error: null });
                            })
                            .catch(function (err) {
                                console.error('PB select error [' + collection + ']:', err);
                                if (reject) reject({ data: null, error: { message: String(err) } });
                                else resolve({ data: null, error: { message: String(err) } });
                            });
                    },
                    catch: function (fn) {
                        return builder.then(null, fn);
                    }
                };
                return builder;
            },

            // UPSERT (insert or update by conflict column)
            upsert: function (record, opts) {
                var conflictCol = (opts && opts.onConflict) || null;
                var pbConflict = conflictCol ? pbIdCol(supaTable, conflictCol) : null;
                var pbRecord = supaToDb(supaTable, record);
                var idValue = pbConflict ? pbRecord[pbConflict] : null;

                return {
                    then: function (resolve, reject) {
                        var doUpsert;
                        if (idValue && pbConflict) {
                            doUpsert = pbFindByField(collection, pbConflict, idValue)
                                .then(function (existing) {
                                    if (existing) {
                                        // UPDATE
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbRecord)
                                        });
                                    } else {
                                        // INSERT
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbRecord)
                                        });
                                    }
                                });
                        } else {
                            doUpsert = fetch(PB_URL + '/api/collections/' + collection + '/records', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(pbRecord)
                            });
                        }

                        return doUpsert
                            .then(function (r) { return r.json(); })
                            .then(function (data) {
                                if (data.code && data.code >= 400) {
                                    resolve({ data: null, error: { message: data.message || 'Upsert failed' } });
                                } else {
                                    resolve({ data: pbToSupa(supaTable, data), error: null });
                                }
                            })
                            .catch(function (err) {
                                console.error('PB upsert error [' + collection + ']:', err);
                                if (reject) reject({ data: null, error: { message: String(err) } });
                                else resolve({ data: null, error: { message: String(err) } });
                            });
                    },
                    catch: function (fn) {
                        return this.then(null, fn);
                    }
                };
            },

            // INSERT
            insert: function (record) {
                var pbRecord = supaToDb(supaTable, record);
                return {
                    then: function (resolve, reject) {
                        return fetch(PB_URL + '/api/collections/' + collection + '/records', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(pbRecord)
                        })
                        .then(function (r) { return r.json(); })
                        .then(function (data) {
                            if (data.code && data.code >= 400) {
                                resolve({ data: null, error: { message: data.message || 'Insert failed' } });
                            } else {
                                resolve({ data: pbToSupa(supaTable, data), error: null });
                            }
                        })
                        .catch(function (err) {
                            console.error('PB insert error [' + collection + ']:', err);
                            if (reject) reject({ data: null, error: { message: String(err) } });
                            else resolve({ data: null, error: { message: String(err) } });
                        });
                    },
                    catch: function (fn) {
                        return this.then(null, fn);
                    }
                };
            },

            // DELETE (chained: .delete().eq(col, val))
            delete: function () {
                return {
                    eq: function (col, val) {
                        var pbCol = pbIdCol(supaTable, col);
                        // Also check field map
                        if (PB_FIELD_MAP[supaTable] && PB_FIELD_MAP[supaTable][col]) {
                            pbCol = PB_FIELD_MAP[supaTable][col];
                        }
                        return {
                            then: function (resolve, reject) {
                                return pbFindByField(collection, pbCol, val)
                                    .then(function (existing) {
                                        if (!existing) {
                                            resolve({ data: null, error: { message: 'Record not found: ' + col + '=' + val } });
                                            return;
                                        }
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'DELETE'
                                        }).then(function (r) {
                                            if (r.ok || r.status === 204) {
                                                resolve({ data: null, error: null });
                                            } else {
                                                return r.json().then(function (d) {
                                                    resolve({ data: null, error: { message: d.message || 'Delete failed' } });
                                                });
                                            }
                                        });
                                    })
                                    .catch(function (err) {
                                        console.error('PB delete error [' + collection + ']:', err);
                                        if (reject) reject({ data: null, error: { message: String(err) } });
                                        else resolve({ data: null, error: { message: String(err) } });
                                    });
                            },
                            catch: function (fn) {
                                return this.then(null, fn);
                            }
                        };
                    }
                };
            },

            // UPDATE (chained: .update(data).eq(col, val))
            update: function (updateData) {
                var pbUpdateData = supaToDb(supaTable, updateData);
                return {
                    eq: function (col, val) {
                        var pbCol = pbIdCol(supaTable, col);
                        if (PB_FIELD_MAP[supaTable] && PB_FIELD_MAP[supaTable][col]) {
                            pbCol = PB_FIELD_MAP[supaTable][col];
                        }
                        return {
                            then: function (resolve, reject) {
                                return pbFindByField(collection, pbCol, val)
                                    .then(function (existing) {
                                        if (!existing) {
                                            resolve({ data: null, error: { message: 'Record not found: ' + col + '=' + val } });
                                            return;
                                        }
                                        return fetch(PB_URL + '/api/collections/' + collection + '/records/' + existing.id, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(pbUpdateData)
                                        })
                                        .then(function (r) { return r.json(); })
                                        .then(function (data) {
                                            if (data.code && data.code >= 400) {
                                                resolve({ data: null, error: { message: data.message || 'Update failed' } });
                                            } else {
                                                resolve({ data: pbToSupa(supaTable, data), error: null });
                                            }
                                        });
                                    })
                                    .catch(function (err) {
                                        console.error('PB update error [' + collection + ']:', err);
                                        if (reject) reject({ data: null, error: { message: String(err) } });
                                        else resolve({ data: null, error: { message: String(err) } });
                                    });
                            },
                            catch: function (fn) {
                                return this.then(null, fn);
                            }
                        };
                    }
                };
            }
        };
    }
};

console.log('PocketBase wrapper loaded. Backend:', PB_URL);

var _ = require('lodash');
var elasticsearch = require('elasticsearch');

// custom variables that will be different for each situation
var searchUrl = 'http://localhost:9200';
var indexName = 'swish';
var sourceName = 'company';
var companyData = [
    {
        _id: 1,
        name: 'Comcast',
        aliases: 'Xfinity Comcst'
    },
    {
        _id: 2,
        name: 'AT&T',
        aliases: 'ATT AT-T'
    }
];

// delete the old index, create a new one and load it with data
function reindex() {
    var es = new elasticsearch.Client({
        host: searchUrl,
        requestTimeout: 120000
    });

    // delete any existing index (obviously don't do this with a live system)
    return es.indices.delete({ index: indexName })
        .then(function () {

            // elasticsearch caches commands sometimes, so flush to be safe
            return es.indices.flush({ index: indexName });
        })
        .then(function () {

            // create the new index with one simple keyword analyzer that
            // treats all text in lowercase
            return es.indices.create({
                index: indexName,
                body: {
                    analysis: {
                        analyzer: {
                            'my_analyzer': {
                                tokenizer:  'keyword',
                                filter:     ['lowercase']
                            }
                        }
                    }
                }
            })
        })
        .then(function () {

            // the mapping is for a specific data set (i.e. company) and defines
            // how each field is treated when searching
            return es.indices.putMapping({
                index: indexName,
                type: sourceName,
                body: {
                    properties: {
                        name: { analyzer: 'my_analyzer', type: 'text', boost: 8.0 },
                        aliases: { analyzer: 'my_analyzer', type: 'text', boost: 1 }
                    }
                }
            });
        })
        .then(function () {
            return es.indices.flush({ index: indexName });
        })
        .then(function () {
            var bulkData = [];

            // in the bulk data array, the index info for an item is followed by the item
            _.each(companyData, function (item) {
                bulkData.push({
                    index: {
                        _index: indexName,
                        _type:  sourceName,
                        _id:    item._id + ''
                    }
                });
                bulkData.push({
                    _id: item._id + '',
                    name: item.name,
                    aliases: item.aliases
                });

            });

            return es.bulk({ body: bulkData });
        })
        .then(function () {
            return es.indices.flush({ index: indexName });
        });
}

// search companies with a given input
function search(searchInput) {
    var es = new elasticsearch.Client({
        host: searchUrl,
        requestTimeout: 120000
    });

    // really basic search here based on the company name and aliases fields
    return es.search({
        index: indexName,
        type: sourceName,
        body: {
            'min_score': 0.1,
            'from': 0,
            'size': 20,
            'query': {
                bool: {
                    should: [{
                        'multi_match': {
                            query: searchInput,
                            fields: ['name', 'aliases'],
                            type: 'best_fields'
                        }
                    }]
                }
            }
        }
    });
}


module.exports = {
    reindex: reindex,
    search: search
};

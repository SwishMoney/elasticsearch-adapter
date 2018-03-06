var _ = require('lodash');
var elasticsearch = require('elasticsearch');

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

function reindex() {
    var es = new elasticsearch.Client({
        host: searchUrl,
        requestTimeout: 120000
    });

    return es.indices.delete({ index: indexName })
        .then(function () {
            return es.indices.flush({ index: indexName });
        })
        .then(function () {
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

function search(searchInput) {
    var es = new elasticsearch.Client({
        host: searchUrl,
        requestTimeout: 120000
    });

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

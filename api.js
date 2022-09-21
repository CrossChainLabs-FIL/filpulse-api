const config = require('./config');
const { INFO, ERROR, WARNING } = require('./logs');
const { Pool } = require("pg");

const pool = new Pool(config.database);

function error_response(code, msg, res) {
    res.status(code).send(msg);
}

// GET
const get = async function (query, view, predicate, req, res, next, log, single_line) {
    try {
        var result = undefined;
        let count_query;
        let main_query;
        let offset = 0;

        if (predicate) {
            count_query = `SELECT COUNT(*) FROM (SELECT ${query} FROM ${view} ${predicate}) AS total;`
            main_query = `SELECT ${query} FROM ${view} ${predicate}`;
        } else {
            count_query = `SELECT COUNT(*) FROM (SELECT ${query} FROM ${view}) AS total;`
            main_query = `SELECT ${query} FROM ${view}`;
        }

        if (!single_line) {
            result = {
                list: [],
                total: 0,
                offset: 0
            };
            console.log('count_query', count_query);
            let count = await pool.query(count_query);

            if ((count?.rows.length > 0) && (count.rows[0].count > 0)) {
                if (req?.query?.offset && (parseInt(req.query.offset) < parseInt(count.rows[0].count))) {
                    offset = parseInt(req?.query?.offset);
                }

                let list = await pool.query(main_query + ` OFFSET ${offset} LIMIT 100;`);
                console.log(main_query + ` OFFSET ${offset} LIMIT 100;`);
                result = {
                    list: list?.rows,
                    total: count.rows[0].count,
                    offset: offset
                }
            }
        } else {
            let list = await pool.query(`SELECT ${query} FROM ${view};`);
            if (list?.rows?.length > 0) {
                result = list.rows[0];
            }
        }

        if (result) {
            if (single_line) {
                INFO(`GET[${log}]: ${JSON.stringify(result)}`);
            } else {
                INFO(`GET[${log}]: offset: ${offset}, total: ${result.total}, items: ${result?.list?.length}`);

            }
            res.json(result);
        } else {
            ERROR(`GET[${log} ${query} on ${view}]: Failed, result: ${JSON.stringify(result)}`);
            error_response(402, `Failed to get ${log}`, res);
        }

    } catch (e) {
        ERROR(`GET[${log} ${query} on ${view}]: error: ${e}`);
        error_response(401, `Failed to get ${log}`, res);
    }
};

const overview = async function (req, res, next) {
    await  get('*', 'overview_view', '', req, res, next, 'overview', true);
};

const top_contributors = async function (req, res, next) {
    await  get('*', 'top_contributors_view', 'ORDER BY contributions DESC', req, res, next, 'top_contributors', false);
};

const commits = async function (req, res, next) {
    await  get('*', 'commits_view', 'ORDER BY commit_month', req, res, next, 'commits', false);
};

const active_contributors = async function (req, res, next) {
    await  get('*', 'active_contributors_view', 'ORDER BY month', req, res, next, 'active_contributors', false);
};

const tab_commits = async function (req, res, next) {
    let predicate = undefined;
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;


    if (repo && organisation) {
        predicate = `WHERE repo = '${repo}' AND organisation = '${organisation}'`;
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE dev_name = '${contributor}'`;
        } else {
            predicate += `AND dev_name = '${contributor}'`
        }
    }


    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'OR ';
        }
        
        predicate +=`dev_name ~* '${req.query.search}' OR \
                     repo ~* '${req.query.search}' OR \
                     organisation ~* '${req.query.search}' OR \
                     message ~* '${req.query.search}' OR \
                     commit_hash ~* '${req.query.search}' \
                     ORDER BY commit_date DESC`
    }

    if (!predicate) {
        predicate = 'ORDER BY commit_date DESC';
    }
            
     await  get('*', 'tab_commits_view', predicate, req, res, next, 'tab_commits', false);

};

const tab_commits_filter_project = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('repo, organisation', 'projects_view', `WHERE repo ~* '${req.query.search}' OR organisation ~* '${req.query.search}'`, req, res, next, 'tab_commits_filter_contributor');
    } else {
        await  get('repo, organisation', 'projects_view', '', req, res, next, 'tab_commits_filter_contributor');
    }
};

const tab_commits_filter_contributor = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as contributor', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_commits_filter_contributor', false);
    } else {
        await  get('dev_name as contributor', 'devs_view', '', req, res, next, 'tab_commits_filter_contributor', false);
    }
};

module.exports = {
    overview,
    top_contributors,
    commits,
    active_contributors,
    tab_commits,
    tab_commits_filter_project,
    tab_commits_filter_contributor
}
const config = require('./config');
const { INFO, ERROR, WARNING } = require('./logs');
const { Pool } = require("pg");
const { createToken, validateToken } = require("./token");
const bcrypt = require("bcryptjs");
const axios = require('axios');

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
            let count = await pool.query(count_query);

            if ((count?.rows.length > 0) && (count.rows[0].count > 0)) {
                if (req?.query?.offset && (parseInt(req.query.offset) < parseInt(count.rows[0].count))) {
                    offset = parseInt(req?.query?.offset);
                }

                let list = await pool.query(main_query + ` OFFSET ${offset} LIMIT ${config.api.limit};`);
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

// GET
const get_query = async function (query, req, res, next, log) {
    try {
        var result = undefined;
        let count_query;
        let main_query;
        let offset = 0;


        count_query = `SELECT COUNT(*) FROM (${query}) AS total;`
        main_query = `${query}`;



        result = {
            list: [],
            total: 0,
            offset: 0
        };
        let count = await pool.query(count_query);

        if ((count?.rows.length > 0) && (count.rows[0].count > 0)) {
            if (req?.query?.offset && (parseInt(req.query.offset) < parseInt(count.rows[0].count))) {
                offset = parseInt(req?.query?.offset);
            }

            let list = await pool.query(main_query + ` OFFSET ${offset} LIMIT ${config.api.limit};`);
            result = {
                list: list?.rows,
                total: count.rows[0].count,
                offset: offset
            }
        }

        if (result) {
            INFO(`GET[${log}]: offset: ${offset}, total: ${result.total}, items: ${result?.list?.length}`);

            res.json(result);
        } else {
            ERROR(`GET[${log} ${query}]: Failed, result: ${JSON.stringify(result)}`);
            error_response(402, `Failed to get ${log}`, res);
        }

    } catch (e) {
        ERROR(`GET[${log} ${query}]: error: ${e}`);
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
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;

    const sortColumns = ['commit_date', 'commit_hash', 'message'];
    const sortMode = ['asc', 'desc'];

    if (!sortBy || !sortColumns.includes(sortBy)) {
        sortBy = 'commit_date';
    }

    if (!sortType || !sortMode.includes(sortType)) {
        sortType = 'desc';
    }


    if (repo && organisation) {
        predicate = `WHERE repo = '${repo}' AND organisation = '${organisation}' `;
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE dev_name = '${contributor}' `;
        } else {
            predicate += `AND dev_name = '${contributor}' `;
        }
    }


    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'AND ';
        }

        predicate += `message ~* '${req.query.search}' `;
    }


    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    await get('*', 'tab_commits_view', predicate, req, res, next, 'tab_commits', false);

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
        await  get('dev_name as contributor, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_commits_filter_contributor', false);
    } else {
        await  get('dev_name as contributor, avatar_url', 'devs_view', '', req, res, next, 'tab_commits_filter_contributor', false);
    }
};

const tab_contributors = async function (req, res, next) {
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;

    const sortColumns = ['contributions', 'open_issues', 'closed_issues', 'open_prs', 'closed_prs'];
    const sortMode = ['asc', 'desc'];

    if (!sortBy || !sortColumns.includes(sortBy)) {
        sortBy = 'contributions';
    }

    if (!sortType || !sortMode.includes(sortType)) {
        sortType = 'desc';
    }

    if (repo && organisation) {
        predicate = `WHERE repo = '${repo}' AND organisation = '${organisation}'`;
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE dev_name = '${contributor}' `;
        } else {
            predicate += `AND dev_name = '${contributor}' `;
        }
    }

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'AND ';
        }

        predicate += `dev_name ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    await get('*', 'tab_contributors_view', predicate, req, res, next, 'tab_contributors', false);

};

const tab_contributors_filter_project = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('repo, organisation', 'projects_view', `WHERE repo ~* '${req.query.search}' OR organisation ~* '${req.query.search}'`, req, res, next, 'tab_contributors_filter_project');
    } else {
        await  get('repo, organisation', 'projects_view', '', req, res, next, 'tab_contributors_filter_project');
    }
};

const tab_contributors_filter_contributor = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as contributor, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_contributors_filter_contributor', false);
    } else {
        await  get('dev_name as contributor, avatar_url', 'devs_view', '', req, res, next, 'tab_contributors_filter_contributor', false);
    }
};

const tab_prs = async function (req, res, next) {
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;
    let status = req?.query?.status;

    console.log(req.query);

    const sortColumns = ['updated_at', 'number', 'title'];
    const sortMode = ['asc', 'desc'];
    const statusValues = ['merged', 'open', 'closed'];

    if (!sortBy || !sortColumns.includes(sortBy)) {
        sortBy = 'tab_prs_view.updated_at';
    }

    if (!sortType || !sortMode.includes(sortType)) {
        sortType = 'desc';
    }

    if (repo && organisation) {
        predicate = `WHERE tab_prs_view.repo = '${repo}' AND tab_prs_view.organisation = '${organisation}'`;
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE tab_prs_view.dev_name = '${contributor}' `;
        } else {
            predicate += `AND tab_prs_view.dev_name = '${contributor}' `;
        }
    }

    if (status || statusValues.includes(status)) {
        if (!predicate) {
            predicate = `WHERE tab_prs_view.state = '${status}' `;
        } else {
            predicate += `AND tab_prs_view.state = '${status}' `;
        }
    }

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'AND ';
        }

        predicate += `tab_prs_view.title ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    if (req.authenticated) {
        let main_query = `
        with watchlist_data as ( SELECT * FROM tab_watchlist_view WHERE user_id = ${req.user_id})
        SELECT
        tab_prs_view.number,
        tab_prs_view.title,
        tab_prs_view.html_url,
        tab_prs_view.dev_name,
        tab_prs_view.avatar_url,
        tab_prs_view.repo,
        tab_prs_view.organisation,
        tab_prs_view.state,
        tab_prs_view.updated_at,
        CASE WHEN watchlist_data.viewed_at is not null THEN true ELSE false END as follow
        FROM tab_prs_view
        LEFT JOIN watchlist_data ON watchlist_data.number = tab_prs_view.number
                         AND watchlist_data.repo = tab_prs_view.repo
                         AND watchlist_data.organisation = tab_prs_view.organisation
        `;

        if (predicate) {
            main_query += predicate;
        }

        await get_query(main_query, req, res, next, 'tab_prs');
    } else {
        await get('*, false as follow', 'tab_prs_view', predicate, req, res, next, 'tab_prs', false);
    }

};

const tab_prs_filter_project = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('repo, organisation', 'projects_view', `WHERE repo ~* '${req.query.search}' OR organisation ~* '${req.query.search}'`, req, res, next, 'tab_prs_filter_project');
    } else {
        await  get('repo, organisation', 'projects_view', '', req, res, next, 'tab_prs_filter_project');
    }
};

const tab_prs_filter_contributor = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as contributor, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_prs_filter_contributor', false);
    } else {
        await  get('dev_name as contributor, avatar_url', 'devs_view', '', req, res, next, 'tab_prs_filter_contributor', false);
    }
};

const tab_issues = async function (req, res, next) {
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let assignee = req?.query?.assignee;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;
    let status = req?.query?.status;

    const sortColumns = ['updated_at', 'number', 'title'];
    const sortMode = ['asc', 'desc'];
    const statusValues = ['open', 'closed'];

    if (!sortBy || !sortColumns.includes(sortBy)) {
        sortBy = 'tab_issues_view.updated_at';
    }

    if (!sortType || !sortMode.includes(sortType)) {
        sortType = 'desc';
    }

    if (repo && organisation) {
        predicate = `WHERE tab_issues_view.repo = '${repo}' AND tab_issues_view.organisation = '${organisation}'`;
    }

    if (assignee) {
        if (!predicate) {
            predicate = `WHERE tab_issues_view.assignees ~* '${assignee}' `;
        } else {
            predicate += `AND tab_issues_view.assignees ~* '${assignee}' `;
        }
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE tab_issues_view.dev_name = '${contributor}' `;
        } else {
            predicate += `AND tab_issues_view.dev_name = '${contributor}' `;
        }
    }

    if (status || statusValues.includes(status)) {
        if (!predicate) {
            predicate = `WHERE tab_issues_view.state = '${status}' `;
        } else {
            predicate += `AND tab_issues_view.state = '${status}' `;
        }
    }

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'AND ';
        }

        predicate += `tab_issues_view.title ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    if (req.authenticated) {
        let main_query = `
    with watchlist_data as ( SELECT * FROM tab_watchlist_view WHERE user_id = ${req.user_id})
    SELECT
        tab_issues_view.number,
        tab_issues_view.title,
        tab_issues_view.html_url,
        tab_issues_view.dev_name,
        tab_issues_view.avatar_url,
        tab_issues_view.repo,
        tab_issues_view.organisation,
        tab_issues_view.state,
        tab_issues_view.assignees,
        tab_issues_view.updated_at,
        CASE WHEN watchlist_data.viewed_at is not null THEN true ELSE false END as follow
        FROM tab_issues_view
        LEFT JOIN watchlist_data ON watchlist_data.number = tab_issues_view.number
                         AND watchlist_data.repo = tab_issues_view.repo
                         AND watchlist_data.organisation = tab_issues_view.organisation
        `;

        if (predicate) {
            main_query += predicate;
        }

        await get_query(main_query, req, res, next, 'tab_issues');
    } else {
        await get('*, false as follow', 'tab_issues_view', predicate, req, res, next, 'tab_issues', false);
    }

};

const tab_issues_filter_project = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('repo, organisation', 'projects_view', `WHERE repo ~* '${req.query.search}' OR organisation ~* '${req.query.search}'`, req, res, next, 'tab_issues_filter_project');
    } else {
        await  get('repo, organisation', 'projects_view', '', req, res, next, 'tab_issues_filter_project');
    }
};

const tab_issues_filter_contributor = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as contributor, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_issues_filter_contributor', false);
    } else {
        await  get('dev_name as contributor, avatar_url', 'devs_view', '', req, res, next, 'tab_issues_filter_contributor', false);
    }
};

const tab_issues_filter_assignee = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as assignee, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_issues_filter_assignee', false);
    } else {
        await  get('dev_name as assignee, avatar_url', 'devs_view', '', req, res, next, 'tab_issues_filter_assignee', false);
    }
};

const tab_releases = async function (req, res, next) {
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;
    let status = req?.query?.status;

    console.log(req.query);

    const sortColumns = ['updated_at', 'id', 'name'];
    const sortMode = ['asc', 'desc'];
    const statusValues = ['Draft', 'Pre-release', 'Released', 'Latest'];

    if (!sortBy || !sortColumns.includes(sortBy)) {
        sortBy = 'updated_at';
    }

    if (!sortType || !sortMode.includes(sortType)) {
        sortType = 'desc';
    }

    if (repo && organisation) {
        predicate = `WHERE repo = '${repo}' AND organisation = '${organisation}'`;
    }

    if (contributor) {
        if (!predicate) {
            predicate = `WHERE dev_name = '${contributor}' `;
        } else {
            predicate += `AND dev_name = '${contributor}' `;
        }
    }

    if (status || statusValues.includes(status)) {
        if (!predicate) {
            predicate = `WHERE state = '${status}' `;
        } else {
            predicate += `AND state = '${status}' `;
        }
    }

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'AND ';
        }

        predicate += `name ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    await get('*', 'tab_releases_view', predicate, req, res, next, 'tab_releases', false);

};

const tab_releases_filter_project = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('repo, organisation', 'projects_view', `WHERE repo ~* '${req.query.search}' OR organisation ~* '${req.query.search}'`, req, res, next, 'tab_issues_filter_project');
    } else {
        await  get('repo, organisation', 'projects_view', '', req, res, next, 'tab_releases_filter_project');
    }
};

const tab_releases_filter_contributor = async function (req, res, next) {
    if (req?.query?.search) {
        await  get('dev_name as contributor, avatar_url', 'devs_view', `WHERE dev_name ~* '${req.query.search}'`, req, res, next, 'tab_issues_filter_contributor', false);
    } else {
        await  get('dev_name as contributor, avatar_url', 'devs_view', '', req, res, next, 'tab_releases_filter_contributor', false);
    }
};

const authenticate = async function (req, res, next) {
    const { code } = req.body;
    const { client_id, client_secret, redirect_uri } = config.login;

    let data = {
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        redirect_uri: redirect_uri
    }

    try {
        INFO(`POST[authenticate]`);

        if (!code) {
            return res.status(400);
        }

        let response = await axios.post(`https://github.com/login/oauth/access_token`, data);
        let params = new URLSearchParams(response.data);
        const access_token = params.get("access_token");


        let user_response = await axios.get(`https://api.github.com/user`, {
            headers: {
                Authorization: `token ${access_token}`,
            },
        });

        if (user_response.status == 200 && user_response?.data?.login && user_response?.data?.type == 'User') {
            let github_user = {
                username: user_response?.data?.login,
                avatar_url: user_response?.data?.avatar_url,
            }

            let values = `'${github_user.username}', '${github_user.avatar_url}'`;
            let query = `\
                UPDATE users SET avatar_url='${github_user.avatar_url}'\
                    WHERE username='${github_user.username}'; \
                INSERT INTO users (username, avatar_url) \
                    SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='${github_user.username}');`;


            await pool.query(query);

            let result = await pool.query(`SELECT id, username, avatar_url FROM users WHERE username='${github_user.username}'`);
            let user_data = result.rows[0];
            const token = createToken(user_data);
            let user = {
                ...user_data,
                token: token
            }

            console.log(user);

            res.json(user);
        }
    } catch (err) {
        console.log(err);
        res.status(400).send("Unable to authenticate user");
        ERROR(`POST[/authenticate] error:${err}`);
    }
};

const follow = async function (req, res, next) {
    try {
        if (req.authenticated) {
            const { number, follow, repo, organisation } = req.query;
            console.log( req.query );

            INFO(`POST[follow] user_id: ${req.user_id}, ${JSON.stringify(req.query)}`);

            if ( number && repo && organisation ) {

                if (follow == 'true') {
                    let values = `${req.user_id}, 
                    ${number},
                    '${repo}',
                    '${organisation}'`;
                    let query = `\
                        INSERT INTO watchlist (user_id, number, repo, organisation) \
                        SELECT ${values} WHERE NOT EXISTS 
                        (SELECT 1 FROM watchlist WHERE number=${number} AND user_id=${req.user_id} AND repo='${repo}' AND organisation='${organisation}');`;
                        
                    await pool.query(query);
                    INFO(`POST[follow] user_id: ${req.user_id}, ${JSON.stringify(req.query)} succesful`);
                } else {
                    let query = `\
                        DELETE FROM watchlist \
                        WHERE number=${number} AND user_id=${req.user_id} AND repo='${repo}' AND organisation='${organisation}';`;
                    await pool.query(query);
                }
                INFO(`POST[follow] user_id: ${req.user_id}, ${JSON.stringify(req.query)} succesful`);
                res.json({ success: true });
            } else {
                res.status(401).send("Invalid params");
            }
        } else {
            res.status(400).send("Invalid token, please login");
        }
    } catch (err) {
        res.status(400).send("Unable to authenticate user");
        ERROR(`POST[/follow] error:${err}`);
    }
};

const view_comments = async function (req, res, next) {
    try {
        if (req.authenticated) {
            const { number, repo, organisation } = req.query;

            INFO(`POST[view_comments] user_id: ${req.user_id}, ${JSON.stringify(req.query)}`);

            if (number && repo && organisation && req.user_id) {
                let query = `
                            UPDATE watchlist SET viewed_at = now()
                            WHERE number=${number} 
                            AND user_id=${req.user_id} 
                            AND repo='${repo}' 
                            AND organisation='${organisation}';`;

                await pool.query(query);

                INFO(`POST[view_comments] user_id: ${req.user_id}, ${JSON.stringify(req.query)} succesful`);
                res.json({ success: true });
            } else {
                res.status(401).send("Invalid params");
            }
        } else {
            res.status(400).send("Invalid token, please login");
        }
    } catch (err) {
        res.status(400).send("Unable to authenticate user");
        ERROR(`POST[/view_comments] error:${err}`);
    }
};

const tab_watchlist = async function (req, res, next) {
    try {
        if (req.authenticated) {
            let predicate = '';
            let sortBy = req?.query?.sortBy;
            let sortType = req?.query?.sortType;
            let status = req?.query?.status;
            let is_pr = req?.query?.is_pr;
        
            const sortColumns = ['updated_at', 'comments', 'number', 'title'];
            const sortMode = ['asc', 'desc'];
            const statusValues = ['open', 'closed'];

            console.log(req.query);
        
            if (!sortBy || !sortColumns.includes(sortBy)) {
                sortBy = 'updated_at';
            }
        
            if (!sortType || !sortMode.includes(sortType)) {
                sortType = 'desc';
            }
        
            if (status || statusValues.includes(status)  && is_pr != undefined) {
                if (!predicate) {
                    predicate = `WHERE state = '${status}' AND is_pr = '${is_pr}' `;
                } else {
                    predicate += `AND state = '${status}' AND is_pr = '${is_pr}' `;
                }
            }
        
            if (req?.query?.search) {
                if (!predicate) {
                    predicate = 'WHERE ';
                } else {
                    predicate += 'AND ';
                }
        
                predicate += `title ~* '${req.query.search}' `;
            }

            if (req?.query?.participant) {
                if (!predicate) {
                    predicate = 'WHERE ';
                } else {
                    predicate += 'AND ';
                }
        
                predicate += `participants ~* '${req.query.participant}' `;
            }

            if (!predicate) {
                predicate = 'WHERE ';
            } else {
                predicate += 'AND ';
            }

            predicate += `user_id = ${req?.user_id} `;

            if (sortBy && sortType) {
                predicate += `ORDER BY ${sortBy} ${sortType}`;
            }
        
            await get('*', 'tab_watchlist_view', predicate, req, res, next, 'tab_watchlist', false);
        } else {
            res.status(400).send("Invalid token, please login");
        }
    } catch (err) {
        res.status(400).send("Unable to authenticate user");
        ERROR(`POST[/tab_watchlist] error:${err}`);
    }
};

const filter_participants = async function (req, res, next) {
    try {
        if (req.authenticated) {
            if (req?.query?.search) {
                await get('dev_name, avatar_url', 'participants_view', `WHERE dev_name ~* '${req.query.search}' AND user_id = ${req?.user_id}`, req, res, next, 'tab_contributors_filter_project');
            } else {
                await get('dev_name, avatar_url', 'participants_view', `WHERE user_id = ${req?.user_id}`, req, res, next, 'tab_contributors_filter_project');
            }
        } else {
            res.status(400).send("Invalid token, please login");
        }
    } catch (err) {
        res.status(400).send("Unable to authenticate user");
        ERROR(`POST[/authenticate] error:${err}`);
    }
};

module.exports = {
    overview,
    top_contributors,
    commits,
    active_contributors,
    tab_commits,
    tab_commits_filter_project,
    tab_commits_filter_contributor,
    tab_contributors,
    tab_contributors_filter_project,
    tab_contributors_filter_contributor,
    tab_prs,
    tab_prs_filter_project,
    tab_prs_filter_contributor,
    tab_issues,
    tab_issues_filter_project,
    tab_issues_filter_contributor,
    tab_issues_filter_assignee,
    tab_releases,
    tab_releases_filter_project,
    tab_releases_filter_contributor,
    authenticate,
    follow,
    tab_watchlist,
    filter_participants,
    view_comments,
}
const config = require('./config');
const { INFO, ERROR, WARNING } = require('./logs');
const { Pool } = require("pg");
const { createToken, validateToken } = require("./token");
const bcrypt = require("bcryptjs");

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

                let list = await pool.query(main_query + ` OFFSET ${offset} LIMIT 100;`);
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
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;

    const sortColumns = ['commit_date'];
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
            predicate += 'OR ';
        }
        
        predicate +=`dev_name ~* '${req.query.search}' OR 
                     repo ~* '${req.query.search}' OR 
                     organisation ~* '${req.query.search}' OR 
                     message ~* '${req.query.search}' OR 
                     commit_hash ~* '${req.query.search}' `;
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

    const sortColumns = ['contributions', 'open_issues', 'closed_issues', 'open_prs', 'merged_prs'];
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
            predicate += 'OR ';
        }

        predicate += `dev_name ~* '${req.query.search}' OR 
                     repo ~* '${req.query.search}' OR 
                     organisation ~* '${req.query.search}' `;
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

    const sortColumns = ['updated_at'];
    const sortMode = ['asc', 'desc'];

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

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'OR ';
        }

        predicate += `title ~* '${req.query.search}' OR 
                     dev_name ~* '${req.query.search}' OR 
                     repo ~* '${req.query.search}' OR 
                     organisation ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    await get('*', 'tab_prs_view', predicate, req, res, next, 'tab_prs', false);

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
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;

    const sortColumns = ['updated_at'];
    const sortMode = ['asc', 'desc'];

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

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'OR ';
        }

        predicate += `title ~* '${req.query.search}' OR 
                     dev_name ~* '${req.query.search}' OR 
                     repo ~* '${req.query.search}' OR 
                     organisation ~* '${req.query.search}' `;
    }

    if (sortBy && sortType) {
        predicate += `ORDER BY ${sortBy} ${sortType}`;
    }

    await get('*', 'tab_issues_view', predicate, req, res, next, 'tab_issues', false);

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

const tab_releases = async function (req, res, next) {
    let predicate = '';
    let repo = req?.query?.repo;
    let organisation = req?.query?.organisation;
    let contributor = req?.query?.contributor;
    let sortBy = req?.query?.sortBy;
    let sortType = req?.query?.sortType;

    const sortColumns = ['updated_at'];
    const sortMode = ['asc', 'desc'];

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

    if (req?.query?.search) {
        if (!predicate) {
            predicate = 'WHERE ';
        } else {
            predicate += 'OR ';
        }

        predicate += `name ~* '${req.query.search}' OR 
                     dev_name ~* '${req.query.search}' OR 
                     repo ~* '${req.query.search}' OR 
                     organisation ~* '${req.query.search}' `;
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

const signup = async function (req, res, next) {
    try {
        let { username, password, question,  answer} = req.body;

        if (!(username && password && question && answer)) {
          res.status(400).send("All input is required");
          return;
        }

        INFO(`POST[/signup] username: ${username}`);

        username = username.toLowerCase();
        answer = answer.toLowerCase();
    
        let result = await pool.query(`SELECT EXISTS(SELECT 1 FROM users WHERE username = '${username}')`);
        if (result?.rows[0]?.exists) {
            res.status(400).send("Username Already Exist. Please Login");
            return;
        }
    
        let encryptedPassword = await bcrypt.hash(password, 10);
        let encryptedAnswer = await bcrypt.hash(answer, 10);
    
        await pool.query(`
            INSERT INTO users (username, password, question, answer) 
            VALUES ('${username}', '${encryptedPassword}', ${question}, '${encryptedAnswer}') 
            `);

        result = await pool.query(`SELECT * FROM users WHERE username = '${username}'`);
        let user_data = result?.rows[0];

        if (user_data) {
            const token = createToken(username);

            let account = {
                id: user_data.id,
                token: token
            }

            res.json(account);
        } else {
            res.status(400).send("Signup Error");
        }
      } catch (err) {
        res.status(400).send("Unable to register user");
        ERROR(`POST[/signup] query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}, error:${err}`);
      }
};

const login = async function (req, res, next) {
    try {
        const { username, password } = req.body;

        if (!(username && password)) {
            res.status(400).send("All input is required");
            return;
        }

        INFO(`POST[/login] username: ${username}`);

        let result = await pool.query(`SELECT * FROM users WHERE username = '${username}'`);
        let user_data = result?.rows[0];

        if (user_data && (await bcrypt.compare(password, user_data.password))) {
            const token = createToken(username);

            let account = {
                id: user_data.id,
                token: token
            }

            res.json(account);
        } else {
            res.status(400).send("Invalid Credentials");
        }
    } catch (err) {
        res.status(400).send("Invalid Credentials");
        ERROR(`POST[/login] query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}, error:${err}`);
    }
};

const reset_password = async function (req, res, next) {
    try {
        let { username, password, question,  answer} = req.body;

        if (!(username && password && question && answer)) {
          res.status(400).send("All input is required");
          return;
        }

        INFO(`POST[/reset_password] username: ${username}`);

        username = username.toLowerCase();
        answer = answer.toLowerCase();

        let result = await pool.query(`SELECT * FROM users WHERE username = '${username}'`);
        let user_data = result?.rows[0];

        if (!user_data) {
            res.status(400).send("Username not found , unable to reset password");
            return;
        }
    
        let encryptedPassword = await bcrypt.hash(password, 10);
        //let encryptedAnswer = await bcrypt.hash(answer, 10);

        //valide answer
        if (await bcrypt.compare(answer, user_data.answer)) {
            //update password 
            await pool.query(`UPDATE users SET password = '${encryptedPassword}' WHERE username = '${username}';`);

            const token = createToken(username);

            let account = {
                id: user_data.id,
                token: token
            }

            res.json(account);
        } else {
            res.status(400).send("Reset password error");
        }

      } catch (err) {
        res.status(400).send("Unable to register user");
        ERROR(`POST[/reset_password] query: ${JSON.stringify(req.query)}, body: ${JSON.stringify(req.body)}, error:${err}`);
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
    tab_releases,
    tab_releases_filter_project,
    tab_releases_filter_contributor,
}
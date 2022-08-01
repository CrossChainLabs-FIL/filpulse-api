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
        var result;
        if (predicate) {
            result = await pool.query(`SELECT ${query} FROM ${view} ${predicate};`);
        } else
        {
            result = await pool.query(`SELECT ${query} FROM ${view};`);
        }

        if (result.rows.length) {
            INFO(`GET[${log}]: ${JSON.stringify(result.rows.length)} results`);

            if (single_line) {
                res.json(result.rows[0]);
            } else {
                res.json(result.rows);
            }
        } else {
            ERROR(`GET[${log} ${query} on ${view}]: Failed, result: ${JSON.stringify(result.rows)}`);
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

const recent_commits = async function (req, res, next) {
    await  get('*', 'recent_commits_view', 'ORDER BY commit_date DESC', req, res, next, 'recent_commits', false);
};


module.exports = {
    overview,
    top_contributors,
    commits,
    active_contributors,
    recent_commits
}
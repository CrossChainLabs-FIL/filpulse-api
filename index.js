const config = require('./config');
const { INFO } = require('./logs');
const { 
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
    authenticate,
} = require('./api');

var express = require("express");
var cors = require('cors');
var app = express();

const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');
const swaggerUi = require('swagger-ui-express');

app.use(cors());
app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/overview", overview);
app.get("/top_contributors", top_contributors);
app.get("/commits", commits);
app.get("/active_contributors", active_contributors);
app.get("/tab_commits", tab_commits);
app.get("/tab_commits/filter/project", tab_commits_filter_project);
app.get("/tab_commits/filter/contributor", tab_commits_filter_contributor);
app.get("/tab_contributors", tab_contributors);
app.get("/tab_contributors/filter/project", tab_contributors_filter_project);
app.get("/tab_contributors/filter/contributor", tab_contributors_filter_contributor);
app.get("/tab_prs", tab_prs);
app.get("/tab_prs/filter/project", tab_prs_filter_project);
app.get("/tab_prs/filter/contributor", tab_prs_filter_contributor);
app.get("/tab_issues", tab_issues);
app.get("/tab_issues/filter/project", tab_issues_filter_project);
app.get("/tab_issues/filter/contributor", tab_issues_filter_contributor);
app.get("/tab_releases", tab_releases);
app.get("/tab_releases/filter/project", tab_releases_filter_project);
app.get("/tab_releases/filter/contributor", tab_releases_filter_contributor);

app.post("/authenticate", authenticate);


app.listen(config.api.port, () => {
    INFO("Startup");
    INFO("FilPulse API V2 running on port: " + config.api.port);
   });
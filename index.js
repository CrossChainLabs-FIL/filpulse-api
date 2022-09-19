const config = require('./config');
const { INFO } = require('./logs');
const { 
    overview,
    top_contributors,
    commits,
    active_contributors,
    tab_commits,
    tab_commits_filter_contributor
} = require('./api');

var express = require("express");
var cors = require('cors');
var app = express();

app.use(cors());
app.use(express.json());

app.get("/overview", overview);
app.get("/top_contributors", top_contributors);
app.get("/commits", commits);
app.get("/active_contributors", active_contributors);
app.get("/tab_commits", tab_commits);
app.get("/tab_commits/filter/contributor", tab_commits_filter_contributor);


app.listen(config.api.port, () => {
    INFO("Startup");
    INFO("FilPulse API running on port: " + config.api.port);
   });
## PM2 Better Deployer

This is a tool, which was created out of frustration with `pm2 deploy` command.
This deployer has a little different command line API, but still should duplicate any functionality of `pm2 deploy`
Some functionality is still in development.

To use, run `pm2-deploy --help`

Tests and full documentation are in development.
Main things this package does over the `pm2 deploy` command:
* Use `ssh2` library for a more js-oriented approach
* Inject environment variables from config not only for the final package, but also for all hooks
* Uses slightly different hook system: hooks in `ecosystem.config.js` can now be arrays of commands, all of which will be executed in order and all must succeed for the hook to be considered executed successfully
* Adds `save_env` deployment setup config key. It can be an array of strings or an object. All elements are filled from  environment variables where the deployment command was run and **saved** into the config on the deployment server. This allows to "pass" environment vars, like secrets from the gitlab runner instance to the pm2 instance

### Possible hooks:
* preSetup - Run before setup (not each deployment)
* postSetup - Run after setup (not each deployment)
* preFetch - Run before fetching from git on deploy
* preDeploy - Run after the repository was fetched - place `npm install` or `pip install` here
* deploy - Actual deployment command - put only a `pm2` command here
* postDeploy - Run right after the deploy hook

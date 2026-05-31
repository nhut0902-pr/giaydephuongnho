const DEFAULT_LOCAL_SITE_URL = 'http://localhost:3000';

function normalizeSiteUrl(value) {
    if (!value || typeof value !== 'string') {
        return DEFAULT_LOCAL_SITE_URL;
    }

    return value.trim().replace(/\/+$/, '');
}

function getConfiguredSiteUrl() {
    return normalizeSiteUrl(
        process.env.APP_URL ||
        process.env.URL ||
        process.env.DEPLOY_PRIME_URL ||
        DEFAULT_LOCAL_SITE_URL
    );
}

module.exports = {
    getConfiguredSiteUrl,
    normalizeSiteUrl
};

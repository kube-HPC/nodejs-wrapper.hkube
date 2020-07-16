
const { Octokit } = require("@octokit/rest");
const { version } = require('../package.json');

const ownerRepo = {
    owner: 'kube-hpc',
    repo: 'hkube'
};

const main = async () => {
    const file = 'core/algorithm-builder/environments/nodejs/wrapper/package.json';
    const octokit = new Octokit({ auth: process.env.GH_TOKEN });
    const packageJsonContentResponse = await octokit.repos.getContent({
        ...ownerRepo,
        path: file
    });
    const packageJsonContentStr = Buffer.from(packageJsonContentResponse.data.content, 'base64').toString('utf-8');
    const packageJsonContent = JSON.parse(packageJsonContentStr);
    const packageJsonSha = packageJsonContentResponse.data.sha;
    // update package json
    packageJsonContent.dependencies['@hkube/nodejs-wrapper'] = `^${version}`;
    const newContent = Buffer.from(JSON.stringify(packageJsonContent, null, 2)).toString('base64');

    const masterShaResponse = await octokit.repos.listCommits({
        ...ownerRepo,
        per_page: 1
    });
    const masterSha = masterShaResponse.data[0].sha;
    const branchName = `update_nodejs_wraper_to_${version.replace('.', '_')}`;
    await octokit.git.createRef({
        ...ownerRepo,
        ref: `refs/heads/${branchName}`,
        sha: masterSha
    });
    await octokit.repos.createOrUpdateFileContents({
        ...ownerRepo,
        path: file,
        message: `update nodejs wrapper to ${version}`,
        branch: branchName,
        sha: packageJsonSha,
        content: newContent
    });

    await octokit.pulls.create({
        ...ownerRepo,
        title: `update nodejs wrapper to ${version}`,
        head: branchName,
        base: 'master'
    });

};

main();

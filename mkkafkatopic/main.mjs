$.shell = `C:/Program Files/Git/usr/bin/bash.exe`;
$.verbose = false;

let main = async () => {
  let topicName = argv.topic.toLowerCase();
  let yamlFileName = `${topicName}.yaml`

  let devPartition = argv['dev-partition'] || 1;
  let stgPartition = argv['stg-partition'] || 1;
  let prodPartition = argv['prod-partition'] || 8;

  let devReplicas = argv['dev-replicas'] || 3;
  let stgReplicas = argv['stg-replicas'] || 3;
  let prodReplicas = argv['prod-replicas'] || 3;
  let repoPath = path.normalize(argv.repos || `${os.homedir}/source/repos`);

  let templateFn = (topic, partitions, replicas) => `apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  labels:
    strimzi.io/cluster: my-cluster
  name: ${topic}
  namespace: kafka
spec:
  config: {}
  partitions: ${partitions}
  replicas: ${replicas}
  topicName: ${topic}
`;

  let devTemplate = templateFn(topicName, devPartition, devReplicas);
  let stgTemplate = templateFn(topicName, stgPartition, stgReplicas);
  let prodTemplate = templateFn(topicName, prodPartition, prodReplicas);

  let updateFn = async (repo, template) => {
    cd(path.join(repoPath, repo, 'helm', 'topics', 'templates'));
    if(await fs.pathExists(yamlFileName)) {
      echo(chalk.yellow(`${repo}/${yamlFileName} already exists`));
      return;
    }
    echo(chalk.green(`Adding topic ${topicName} to ${repo}`))
    await $`git checkout master`;
    await $`git pull`;
    await $`git checkout -B ${topicName}`;
    await fs.outputFile(yamlFileName, template);
    await $`git add -A`;
    await $`git commit -m "Adds ${topicName} template"`;
    await $`git push -u origin ${topicName}`;
    echo(chalk.green(`https://github.com/lytxinc/${repo}/pull/new/${topicName}`))
  }

  let devUpdate = within(async () => {
      await updateFn('kafka-topics-dev', devTemplate);
  });

  let stgUpdate = within(async () => {
    await updateFn('kafka-topics-stg', stgTemplate);
  });

  let prodUpdate = within(async () => {
    await updateFn('kafka-topics-prod', prodTemplate);
  });

  await Promise.all([devUpdate, stgUpdate, prodUpdate]);
}

if (argv.help) {
  echo('--topic={topic.name}');
  echo('--dev-partition={number} # default = 1');
  echo('--stg-partition={number} # default = 1');
  echo('--prod-partition={number} # default = 8');
  echo('--dev-replicas={number} # default = 3');
  echo('--stg-replicas={number} # default = 3');
  echo('--prod-replicas={number} # default = 3');
  echo('--repos={path/to/repos} # default = ~/source/repos');
} else {
  await main();
}
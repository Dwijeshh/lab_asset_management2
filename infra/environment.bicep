targetScope = 'resourceGroup'

@description('Short lowercase prefix, at most 10 characters.')
@maxLength(10)
param prefix string
@allowed(['staging', 'production'])
param stage string
param location string = resourceGroup().location
@description('Name of the shared ACR.')
param registryName string
@description('Resource group holding the shared ACR.')
param registryResourceGroup string
@description('Initial immutable web image from ACR, including @sha256 digest.')
param appImage string
@description('Initial immutable migration image from ACR, including @sha256 digest.')
param migrationImage string
@secure()
param postgresAdminPassword string
@secure()
param jwtSecret string
param postgresAdminLogin string = 'labassetadmin'

var baseName = '${prefix}-${stage}'
var postgresName = '${baseName}-pg-${uniqueString(resourceGroup().id)}'
var vaultName = '${baseName}-kv-${uniqueString(resourceGroup().id)}'
var secretsUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
  scope: resourceGroup(registryResourceGroup)
}

resource network 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${baseName}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.40.0.0/16']
    }
  }
}

resource appSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: network
  name: 'container-apps'
  properties: {
    addressPrefix: '10.40.0.0/23'
    delegations: [
      {
        name: 'container-apps-delegation'
        properties: {
          serviceName: 'Microsoft.App/environments'
        }
      }
    ]
  }
}

resource dbSubnet 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' = {
  parent: network
  name: 'postgres'
  properties: {
    addressPrefix: '10.40.2.0/24'
    delegations: [
      {
        name: 'postgres-delegation'
        properties: {
          serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
        }
      }
    ]
  }
}

resource postgresDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${baseName}.postgres.database.azure.com'
  location: 'global'
}

resource postgresDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: postgresDns
  name: '${baseName}-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: network.id
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 14
      geoRedundantBackup: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: dbSubnet.id
      privateDnsZoneArmResourceId: postgresDns.id
      publicNetworkAccess: 'Disabled'
    }
  }
  dependsOn: [postgresDnsLink]
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'labasset'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${baseName}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${baseName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: appSubnet.id
      internal: false
    }
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enabledForTemplateDeployment: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

resource dbSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${database.name}?sslmode=require'
  }
}

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'jwt-secret'
  properties: {
    value: jwtSecret
  }
}

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-web-id'
  location: location
}

resource migrationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-migration-id'
  location: location
}

resource appVaultRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, secretsUserRole)
  scope: vault
  properties: {
    roleDefinitionId: secretsUserRole
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource migrationVaultRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, migrationIdentity.id, secretsUserRole)
  scope: vault
  properties: {
    roleDefinitionId: secretsUserRole
    principalId: migrationIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

module acrPullAssignments './acr-pull.bicep' = {
  name: '${baseName}-acr-pull'
  scope: resourceGroup(registryResourceGroup)
  params: {
    registryName: registryName
    appPrincipalId: appIdentity.properties.principalId
    migrationPrincipalId: migrationIdentity.properties.principalId
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${baseName}-web'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${appIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: appsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        traffic: [{ latestRevision: true, weight: 100 }]
      }
      registries: [{ server: registry.properties.loginServer, identity: appIdentity.id }]
      secrets: [
        { name: 'database-url', keyVaultUrl: 'https://${vault.name}.${environment().suffixes.keyvaultDns}/secrets/database-url', identity: appIdentity.id }
        { name: 'jwt-secret', keyVaultUrl: 'https://${vault.name}.${environment().suffixes.keyvaultDns}/secrets/jwt-secret', identity: appIdentity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: appImage
          env: [
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'AUTH_PROVIDER', value: 'local' }
          ]
          resources: { cpu: json('0.5'), memory: '1Gi' }
          probes: [
            { type: 'Startup', tcpSocket: { port: 3000 }, periodSeconds: 5, failureThreshold: 30 }
            { type: 'Liveness', tcpSocket: { port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
            { type: 'Readiness', httpGet: { path: '/api/health', port: 3000, scheme: 'HTTP' }, periodSeconds: 10, failureThreshold: 3 }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
  dependsOn: [appVaultRead, acrPullAssignments, dbSecret, jwtSecretResource]
}

resource migrationJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${baseName}-migrate'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${migrationIdentity.id}': {}
    }
  }
  properties: {
    environmentId: appsEnvironment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: registry.properties.loginServer, identity: migrationIdentity.id }]
      secrets: [{ name: 'database-url', keyVaultUrl: 'https://${vault.name}.${environment().suffixes.keyvaultDns}/secrets/database-url', identity: migrationIdentity.id }]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: migrationImage
          env: [{ name: 'DATABASE_URL', secretRef: 'database-url' }]
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
    }
  }
  dependsOn: [migrationVaultRead, acrPullAssignments, dbSecret]
}

output appName string = app.name
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output migrationJobName string = migrationJob.name
output postgresServerName string = postgres.name
output vaultName string = vault.name

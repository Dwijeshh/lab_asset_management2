targetScope = 'resourceGroup'

param registryName string
param appPrincipalId string
param migrationPrincipalId string

var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

resource appAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, appPrincipalId, acrPullRole)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRole
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource migrationAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, migrationPrincipalId, acrPullRole)
  scope: registry
  properties: {
    roleDefinitionId: acrPullRole
    principalId: migrationPrincipalId
    principalType: 'ServicePrincipal'
  }
}

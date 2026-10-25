targetScope = 'resourceGroup'

@description('Globally unique lowercase ACR name; share this registry across staging and production.')
param registryName string
param location string = resourceGroup().location

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
  }
}

output loginServer string = registry.properties.loginServer
output registryId string = registry.id

# App.tsx Integration Instructions

## Issue
The new components are imported but not actually rendered in App.tsx. The dev server is showing the old version because the new components aren't in the JSX render tree.

## Required Changes

### 1. Add WazeLikeSearch to Navigation Page (Line ~1130)

Replace the simple search UI with:

```tsx
{activePage === 'geodesic' && (
  <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
    <div className="flex-1 relative z-0">
      {/* Add WazeLikeSearch at top */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <WazeLikeSearch
          userLocation={currentLocation || undefined}
          onLocationSelected={(result) => {
            console.log('Location selected:', result);
            // Set as destination for routing
          }}
        />
      </div>
      
      <NavigatorMap
        currentLocation={currentLocation || undefined}
        destination={currentRoute?.geometry.coordinates[currentRoute.geometry.coordinates.length - 1]}
        route={currentRoute || undefined}
        onMapClick={handleMapClick}
        onLocationFound={handleLocationFound}
        className="h-full"
      />
    </div>
```

### 2. Add FlowerOfLifeMarker to Map (NavigatorMap.tsx or in App)

```tsx
{/* After NavigatorMap, add Flower of Life marker for destination */}
{destination && (
  <FlowerOfLifeMarker
    position={[destination[1], destination[0]]}
    map={mapInstance}
    color="#00ffff"
    size={40}
  />
)}
```

### 3. Add LocationShareButton to Chat (Line ~1096)

In the mesh/chat page section, add location sharing:

```tsx
<DiegeticTerminal 
  messages={messages}
  onSend={handleSendMessage}
  onFileUpload={handleFileUpload}
  onVoiceMessage={handleVoiceMessage}
  fileProgress={fileProgress}
  isVerifying={isVerifying}
  nodeId="12D3KooWG3ZKPLocal"
  onCall={(type) => setModal(type === 'voice' ? 'call_voice' : 'call_video')}
  // ... other props
/>

{/* Add location sharing UI below terminal */}
<div className="border-t border-[#4caf50]/20 p-4">
  <LocationShareButton
    onShareCurrent={async () => {
      const location = await locationSharingService.getCurrentLocation();
      // Send location message
    }}
    onPickLocation={() => {
      // Show location picker modal
    }}
    onShareLive={() => {
      // Show live location share modal
    }}
  />
</div>
```

### 4. Use ContactList Component

Create a new page state for contacts or replace the mesh page sidebar with ContactList:

```tsx
{activePage === 'contacts' && (
  <div className="flex-1 overflow-hidden">
    <ContactList
      onSelectContact={(contact) => {
        console.log('Selected contact:', contact);
        // Navigate to chat with this contact
      }}
    />
  </div>
)}
```

## Quick Integration File

I'm creating a simplified integration component that you can import and use.

# WebRTC/Twilio Device Status Mapping Plan

## All Possible WebRTC Statuses and Events

### 1. Twilio Device Events (device.on())
Based on Twilio Voice JavaScript SDK documentation and current code:

**Device Lifecycle Events:**
- `ready` - Device is ready for calls (session established)
- `error` - Device error occurred
- `registering` - Device is registering with Twilio servers
- `registered` - Device successfully registered
- `unregistered` - Device unregistered (needs re-registration)
- `tokenWillExpire` - Authentication token about to expire
- `destroyed` - Device was destroyed

**Call Events:**
- `connect` - Call connected to conference
- `disconnect` - Call disconnected (device stays active)
- `incoming` - Incoming call received
- `cancel` - Call was cancelled

### 2. Twilio Device States (device.state)
- `ready` - Device ready for calls
- `registered` - Device registered with Twilio
- `registering` - Currently registering
- `unregistered` - Not registered
- `destroyed` - Device destroyed

### 3. Connection States (from Connection object)
- `pending` - Connection pending
- `connecting` - Connection in progress
- `ringing` - Call is ringing
- `open` - Connection open (call active)
- `closed` - Connection closed

### 4. Application-Level Statuses (dialingStatus)
Current values found in code:
- `idle` - No active call
- `dialing` - Dialing in progress
- `connected` - Call connected
- `ready` - Ready for next call
- `in_progress` - Call in progress

### 5. Call Status Values (callStatus)
Current values found in code:
- `idle` - No call
- `connected` - Call connected
- `in_call` - In call
- `incoming` - Incoming call
- `calling` - Calling
- `connecting_direct` - Connecting directly
- `calling_direct` - Calling directly
- `connected_direct` - Connected directly
- `dialing_lead` - Dialing lead
- `initiating` - Initiating call
- `failed` - Call failed
- `completed` - Call completed
- `waiting` - Waiting
- `ringing` - Ringing
- `ended` - Call ended
- `webrtc-connected` - WebRTC connected

### 6. UI Status Strings (status in CallConnectorPro)
- `Not Connected` - WebRTC not connected
- `WebRTC Ready` - Device ready, no active call
- `Connected` - Call connected
- `Dialing...` - Dialing in progress

## Current Issues

1. **Missing Event Handlers**: Some device events may not be handled (tokenWillExpire, destroyed)
2. **Inconsistent Status Mapping**: Different components use different status values for same state
3. **Missing State Transitions**: Some state transitions may not be handled
4. **Status Synchronization**: Device state, connection state, and application state may get out of sync

## Mapping Plan

### Phase 1: Document All Status Mappings

Create a centralized status mapping that converts:
- Twilio Device events → Application dialingStatus
- Twilio Device states → Application deviceState
- Connection states → Application callStatus
- All statuses → Unified status enum

### Phase 2: Create Status Handler

Create a unified status handler that:
- Listens to all device events
- Maps them to application states
- Updates all relevant state variables consistently
- Handles edge cases and error states

### Phase 3: Update All Components

Ensure all components use the unified status mapping:
- OutboundDialerInterface.tsx
- RecruitOutboundDialerInterface.tsx
- CallConnectorPro.tsx
- Any other components using WebRTC status

### Phase 4: Add Missing Handlers

Add handlers for currently unhandled events:
- `tokenWillExpire` - Refresh token before expiration
- `destroyed` - Clean up and reinitialize if needed
- Better error handling for all error types

## Implementation Details

### Status Mapping Table

| Twilio Event/State | Application dialingStatus | Application callStatus | UI Status |
|-------------------|--------------------------|----------------------|-----------|
| device.ready | ready | idle | WebRTC Ready |
| device.error | error | failed | Error |
| device.registering | registering | idle | Registering... |
| device.registered | ready | idle | WebRTC Ready |
| device.unregistered | unregistered | idle | Not Connected |
| device.connect | connected | connected | Connected |
| device.disconnect | idle | idle | WebRTC Ready |
| device.incoming | incoming | incoming | Incoming Call |
| device.cancel | idle | idle | WebRTC Ready |
| connection.pending | dialing | calling | Dialing... |
| connection.ringing | dialing | ringing | Ringing... |
| connection.open | connected | connected | Connected |
| connection.closed | idle | completed | Call Ended |

### Unified Status Enum

```typescript
type WebRTCDeviceStatus = 
  | 'uninitialized'    // Device not created
  | 'initializing'     // Device being created
  | 'registering'      // Registering with Twilio
  | 'registered'       // Registered and ready
  | 'unregistered'     // Unregistered (error or manual)
  | 'ready'            // Ready for calls
  | 'error'            // Device error
  | 'destroyed';       // Device destroyed

type WebRTCCallStatus =
  | 'idle'             // No call
  | 'initiating'       // Starting call
  | 'dialing'          // Dialing
  | 'ringing'          // Ringing
  | 'connecting'       // Connecting
  | 'connected'        // Call connected
  | 'disconnecting'    // Disconnecting
  | 'disconnected'     // Disconnected
  | 'failed'           // Call failed
  | 'cancelled'        // Call cancelled
  | 'completed';       // Call completed
```

## Files to Update

1. **Create unified status handler**: `client/src/hooks/useWebRTCStatus.ts`
2. **Update OutboundDialerInterface.tsx**: Use unified status handler
3. **Update RecruitOutboundDialerInterface.tsx**: Use unified status handler
4. **Update CallConnectorPro.tsx**: Use unified status handler
5. **Add token refresh handler**: Handle `tokenWillExpire` event
6. **Add error recovery**: Better error handling and recovery

## Testing Checklist

- [ ] All device events are handled
- [ ] All device states are mapped correctly
- [ ] All connection states are mapped correctly
- [ ] Status transitions are smooth and consistent
- [ ] Error states are handled gracefully
- [ ] Token expiration is handled
- [ ] Device re-registration works
- [ ] Status synchronization across components

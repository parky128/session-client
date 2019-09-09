import { AlStopwatch, AlBehaviorPromise } from '@al/common';
import { AlLocation, AlLocatorService, AlLocationContext } from '@al/common/locator';
import { AIMSSessionDescriptor } from '@al/aims';

export class AlConduitClient
{
    protected static document:Document;
    protected static conduitUri:string;
    protected static conduitWindow:Window;
    protected static conduitOrigin:string;
    protected static refCount:number = 0;
    protected static ready = new AlBehaviorPromise<boolean>();
    protected static requests: { [requestId: string]: any } = {};
    protected static requestIndex = 0;

    constructor() {
    }

    public start( targetDocument:Document = document ) {
        if ( AlConduitClient.refCount < 1 ) {
            AlConduitClient.document = targetDocument;
            AlConduitClient.document.body.append( this.render() );
            AlStopwatch.once(this.validateReadiness, 5000);
        }
        AlConduitClient.refCount++;
    }

    public render():DocumentFragment {
        AlConduitClient.conduitUri = AlLocatorService.resolveURL( AlLocation.AccountsUI, '/conduit.html', { residency: 'US' } );
        const fragment = document.createDocumentFragment();
        const container = document.createElement( "div" );
        container.setAttribute("id", "conduitClient" );
        container.setAttribute("class", "conduit-container" );
        window.addEventListener( "message", this.onReceiveMessage, false );
        fragment.appendChild( container );
        container.innerHTML = `<iframe frameborder="0" src="${AlConduitClient.conduitUri}" style="width:1px;height:1px;"></iframe>`;
        return fragment;
    }

    public stop() {
        if ( AlConduitClient.refCount > 0 ) {
            AlConduitClient.refCount--;
        }
        if ( AlConduitClient.refCount === 0 && AlConduitClient.document ) {
            let container = AlConduitClient.document.getElementById( "conduitClient" );
            if ( container ) {
                AlConduitClient.document.body.removeChild( container );
            }
        }
    }

    /**
     * Retrieves session information from the conduit.  Resolves with valid session information if a session exists, or null if no session is established;
     * an error indicates a problem with conduit operation rather than the absence of a session.
     */
    public getSession(): Promise<AIMSSessionDescriptor> {
        return this.request('conduit.getSession')
                    .then( rawResponse => rawResponse.session as AIMSSessionDescriptor );
    }

    /**
     * Sets session information TO the conduit.  Should always resolve with a copy of the session information.
     */
    public setSession(sessionData: AIMSSessionDescriptor): Promise<AIMSSessionDescriptor> {
        return this.request('conduit.setSession', { session: sessionData })
                    .then( rawResponse => rawResponse.session as AIMSSessionDescriptor );
    }

    /**
     * Deletes existing session information.
     */
    public deleteSession(): Promise<boolean> {
        return this.request('conduit.deleteSession')
                    .then( rawResponse => true );
    }

    /**
     * Retrieves a global setting from conduit's local storage
     */
    public getGlobalSetting(settingKey: string): Promise<any> {
        return this.request("conduit.getGlobalSetting", { setting_key: settingKey })
            .then( rawResponse => rawResponse.setting );
    }

    /**
     * Sets a global setting to conduit's local storage
     */
    public setGlobalSetting(key: string, data: any): Promise<any> {
        return this.request("conduit.setGlobalSetting", { setting_key: key, setting_data: data })
            .then( rawResponse => rawResponse.setting );
    }

    /**
     * Deletes a global setting from conduit's local storage
     */
    public deleteGlobalSetting(settingKey: string): Promise<boolean> {
        return this.request('conduit.deleteGlobalSetting', { setting_key: settingKey })
                    .then( rawResponse => rawResponse.result );
    }

    /**
     * Receives a message from conduit, and dispatches it to the correct handler.
     */
    public onReceiveMessage = (event: any):void => {
        if ( ! event.data
                || typeof (event.data.type) !== 'string'
                || typeof (event.data.requestId) !== 'string'
                || ! event.origin
                || ! event.source) {
            //  Disqualify events that aren't of the correct type/structure
            return;
        }

        const originNode = AlLocatorService.getNodeByURI(event.origin);
        if ( ! originNode || originNode.locTypeId !== AlLocation.AccountsUI ) {
            //  Ignore any events that don't originate from a console.account domain
            return;
        }

        switch (event.data.type) {
            case 'conduit.ready':
                return this.onConduitReady(event);
            case 'conduit.getSession':
            case 'conduit.setSession':
            case 'conduit.deleteSession':
            case 'conduit.getGlobalSetting':
            case 'conduit.setGlobalSetting':
            case 'conduit.deleteGlobalSetting':
                return this.onDispatchReply(event);
            default:
                console.warn('O3ConduitService: Ignoring unrecognized message type: %s', event.data.type, event);
                break;
        }
    }

    public onConduitReady(event: any ): void {
        AlConduitClient.conduitWindow = event.source;
        AlConduitClient.conduitOrigin = event.origin;
        AlConduitClient.ready.resolve( true );
    }

    public onDispatchReply(event: any): void {
        const requestId: string = event.data.requestId;
        if (!AlConduitClient.requests.hasOwnProperty(requestId)) {
            console.warn(`Warning: received a conduit response to an unknown request with ID '${requestId}'; multiple clients running?` );
            return;
        }

        AlConduitClient.requests[requestId]( event.data );
        delete AlConduitClient.requests[requestId];
    }

    /**
     * This validation step is included *mostly* for the sanity of developers.  It is remarkably easy to forget to start o3-portero :)  It
     * may help detect problems in production as a fringe benefit.
     */
    protected validateReadiness = () => {
        if (!AlConduitClient.conduitWindow && !AlConduitClient.conduitOrigin) {
            console.warn('Conduit Warning: no conduit.ready message was received from the console.account conduit application.  This may result in degradation or unavailability of authentication features in this application.');
        }
    }

    protected request( methodName: string, data: any = {} ): Promise<any> {
        return new Promise<any>( ( resolve, reject ) => {
            AlConduitClient.ready.then( () => {
                const requestId = `conduit-request-${++AlConduitClient.requestIndex}-${Math.floor(Math.random() * 1000)}`;

                /**
                 * Requests can be queued at any time in the application's lifespan, even before the conduit iframe has been created or communications
                 * have been established.  However, no actually message will be broadcast until the initial handshake has occurred.
                 */
                AlConduitClient.requests[requestId] = resolve;
                const payload = Object.assign({ type: methodName, requestId: requestId }, data);
                const targetOrigin = AlLocatorService.resolveURL(AlLocation.AccountsUI, null, { residency: 'US' } );
                AlConduitClient.conduitWindow.postMessage(payload, targetOrigin);
            } );
        } );
    }
}

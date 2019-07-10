import { AlStopwatch } from '@al/haversack/utility';
import { AlBehaviorPromise } from '@al/haversack/promises';
import { AlLocation, AlLocatorService } from '@al/haversack/locator';
import { ALClient } from '@al/client';
import { AIMSSessionDescriptor } from '@al/aims';

export class AlConduitClient
{
    protected conduitUri:string;
    protected conduitWindow:Window;
    protected conduitOrigin:string;
    protected requests: { [requestId: string]: any } = {};
    protected requestIndex = 0;
    protected ready = new AlBehaviorPromise<boolean>();

    constructor() {
    }

    public start( targetDocument:Document = document ) {
        this.conduitUri = ALClient.resolveLocation( AlLocation.AccountsUI, '/conduit.html' );
        document.body.append( this.render() );
        AlStopwatch.once(this.validateReadiness, 5000);
    }

    public render():DocumentFragment {
        let fragment = document.createDocumentFragment();
        let container = document.createElement( "div" );
        window.addEventListener( "message", this.onReceiveMessage, false );
        fragment.appendChild( container );
        container.innerHTML = `
            <div class="conduit-container">
                <iframe frameborder="0" src="${this.conduitUri}" style="width:1px;height:1px;"></iframe>
            </div>`.trim();
        return fragment;
    }

    public stop() {
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
                return this.onDispatchReply(event);
            default:
                console.warn('O3ConduitService: Ignoring unrecognized message type: %s', event.data.type, event);
                break;
        }
    }

    public onConduitReady(event: any ): void {
        this.conduitWindow = event.source;
        this.conduitOrigin = event.origin;
        this.ready.resolve( true );
    }

    public onDispatchReply(event: any): void {
        const requestId: string = event.data.requestId;
        if (!this.requests.hasOwnProperty(requestId)) {
            console.warn(`Warning: conduit message with request ID ${requestId} received, but no matching response observable was found.`);
            return;
        }

        this.requests[requestId]( event.data );
        delete this.requests[requestId];
    }

    /**
     * This validation step is included *mostly* for the sanity of developers.  It is remarkably easy to forget to start o3-portero :)  It
     * may help detect problems in production as a fringe benefit.
     */
    protected validateReadiness = () => {
        if (!this.conduitWindow && !this.conduitOrigin) {
            console.warn('Conduit Warning: no conduit.ready message was received from the console.account conduit application.  This may result in degradation or unavailability of authentication features in this application.');
        }
    }

    protected request( methodName: string, data: any = {} ): Promise<any> {
        return new Promise<any>( ( resolve, reject ) => {
            this.ready.then( () => {
                const requestId = `conduit-request-${++this.requestIndex}-${Math.floor(Math.random() * 1000)}`;

                /**
                 * Requests can be queued at any time in the application's lifespan, even before the conduit iframe has been created or communications
                 * have been established.  However, no actually message will be broadcast until the initial handshake has occurred.
                 */
                this.requests[requestId] = resolve;
                const payload = Object.assign({ type: methodName, requestId: requestId }, data);
                const targetOrigin = ALClient.resolveLocation(AlLocation.AccountsUI);
                this.conduitWindow.postMessage(payload, targetOrigin);
                AlStopwatch.once(   () => {
                                        if (this.requests.hasOwnProperty(requestId)) {
                                            console.warn(`WARNING: conduit request ${requestId} (${methodName}) timed out (10s)!`);
                                        }
                                    },
                                    10000 );
            } );
        } );
    }
}

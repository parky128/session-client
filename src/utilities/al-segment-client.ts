import { AlLocation, AlLocatorService, AlGlobalizer } from '@al/common';

/**
 *  This is a simple prototype of the functionality on the segment analytics object
 *  that we actually use.
 *
 *  Based on the API defined here: https://segment.com/docs/sources/server/http/
 */
export interface ISegmentAnalytics
{
    track( eventName:string, properties:{[propName:string]:any}, options:{[optName:string]:any} ):void;
    identify(id:string, properties:{[propName:string]:any}):void;
    group(id:string, properties:{[propName:string]:any}):void;
    debug(enable:boolean):void;
}

/**
 * An empty implementation of ISegmentAnalytics for NodeJS execution
 */
class NullSegmentAnalytics implements ISegmentAnalytics
{
    constructor() {
        console.warn("Notice: using NullSegmentAnalytics interface.  This should only be used for debugging purpose, and will not actually communicate with segment.io." );
    }
    track( eventName, properties:{[propName:string]:any}, options:{[optName:string]:any} ) {}
    identify(id:string, properties:{[propName:string]:any}):void {}
    group(id:string, properties:{[propName:string]:any}):void {}
    debug(enable:boolean):void {}
}

/**
 *  A simple model of the data sent to the segment IO 'track' method
 */
export class AlSegmentIOTrackedEvent {
    eventName:string;
    properties?:{[propName:string]:any};
    options?:{[optName:string]:any};
}

export class AlSegmentClient
{
    protected analytics:ISegmentAnalytics;

    /**
     *  Instantiates the SegmentIOService.
     *  @constructor
     */
    constructor() {
    }

    /**
     *  Tracks a single event.
     *
     *  @param eventName The name of the event.  Please review SegmentIO's recommended
     *                  event naming conventions, they're worth considering.
     *  @param properties A map of properties to pass along with the event.
     *  @param options A map of options to pass along to segment.
     */
    public trackEvent ( eventName:string, properties?:{[propName:string]:any}, options?:{[optName:string]:any} ):void {
        this.getAnalytics().track( eventName, properties, options );
    }

    /**
     *  Tracks a identify event.
     *
     *  @param id  Unique identifier
     *  @param properties A map of properties to pass along with the event.
     */
    public identifyEvent ( id:string, properties:Object = {} ):void {
        this.getAnalytics().identify(id, properties);
    }

    /**
     *  Tracks a group event.
     *
     *  @param id  Unique identifier
     *  @param properties A map of properties to pass along with the event.
     */
    public groupEvent ( id:string, properties:Object = {} ):void {
        this.getAnalytics().group(id, properties);
    }

    /**
     *  Retrieves the SegmentIO Analytics interface, instantiating it if it is not already available.
     *
     *  @returns A reference to the global analytics interface.
     */
    public getAnalytics():ISegmentAnalytics {
        if ( this.analytics ) {
            return this.analytics;
        }

        let segmentNode = AlLocatorService.getNode( AlLocation.Segment );
        if ( ! ( segmentNode && segmentNode.data && segmentNode.data.analyticsKey ) ) {
            return new NullSegmentAnalytics();
        }

        if ( typeof( window ) === 'undefined' ) {
            return new NullSegmentAnalytics();
        }

        /* tslint:disable */
        /*  we will cast window to any so that we may have our way with it in true, wild wild West javascript style */
        const _window = window as any;
        if ( ! _window.analytics ) {
            (function(){var analytics=_window.analytics=_window.analytics||[];if(!analytics.initialize)if(analytics.invoked)_window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t){var e=document.createElement("script");e.type="text/javascript";e.async=!0;e.src=("https:"===document.location.protocol?"https://":"http://")+"cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(e,n)};analytics.SNIPPET_VERSION="4.0.0";
                analytics.load( segmentNode.data.analyticsKey );
            }})();
        }

        this.analytics = <ISegmentAnalytics>_window.analytics;
        /* tslint:enable */
        return this.analytics;
    }
}

/* tslint:disable:variable-name */
export const AlSegmentService:AlSegmentClient = AlGlobalizer.instantiate( "AlSegmentService", () => new AlSegmentClient() );

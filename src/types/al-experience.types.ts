import { getJsonPath } from '@al/common';

export interface AlExperienceNode {
    available?:string[];
    selected?:string;
    prompt?:string;
    [child:string]:null|string|string[]|AlExperienceTree;
}

export class AlExperienceTree implements AlExperienceNode {
    public available:string[] = [];
    public selected:string = null;
    public prompt:string = null;
    [child:string]:any;

    constructor( raw?:unknown ) {
        if ( raw ) {
            Object.assign( this, raw );
        }
    }

    public query<Type=any>( path:string|string[], defaultValue?:Type ):Type {
        return getJsonPath( this, path, defaultValue );
    }
}

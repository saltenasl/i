import { type Extraction, type ExtractionDebug, type ExtractionLaneId, type ExtractionLaneResult } from '@repo/auto-extract';
import { type ExtractionHistoryRepository, type NoteRepository, type PrimaryDbClient, type UserDbClient } from '@repo/db';
export type Variables = {
    primaryDb: PrimaryDbClient;
    userDb: UserDbClient;
    user: {
        id: string;
        email: string;
    };
    noteRepo: NoteRepository;
    extractionRepo: ExtractionHistoryRepository;
};
export type Env = {
    Variables: Variables;
};
export interface AppDependencies {
    getPrimaryDb?: () => Promise<PrimaryDbClient>;
    getUserDb?: (userId: string) => Promise<UserDbClient>;
    runExtractionBundle?: (text: string) => Promise<{
        extraction: Extraction;
        debug: ExtractionDebug;
    }>;
    runExtractionCompareLane?: (text: string, laneId: ExtractionLaneId) => Promise<ExtractionLaneResult>;
}
export declare const createApp: (deps?: AppDependencies) => import("hono/hono-base").HonoBase<Env, {
    "/api/health": {
        $get: {
            input: {};
            output: {
                status: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/auth/google": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 500;
        } | {
            input: {};
            output: undefined;
            outputFormat: "redirect";
            status: 302;
        };
    };
} & {
    "/api/auth/google/callback": {
        $get: {
            input: {};
            output: undefined;
            outputFormat: "redirect";
            status: 302;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 400;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 500;
        };
    };
} & {
    "/api/auth/mock-login": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 404;
        } | {
            input: {};
            output: {
                ok: true;
                user: {
                    id: string;
                    googleId: string;
                    email: string;
                    createdAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/auth/me": {
        $get: {
            input: {};
            output: {
                ok: true;
                user: {
                    id: string;
                    email: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        };
    };
} & {
    "/api/auth/logout": {
        $post: {
            input: {};
            output: {
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/notes/list": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                notes: {
                    id: string;
                    title: string;
                    body: string | null;
                    createdAt: string;
                    updatedAt: string;
                }[];
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/notes/create": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                note: {
                    id: string;
                    title: string;
                    body: string | null;
                    createdAt: string;
                    updatedAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/run": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                extraction: {
                    title: string;
                    noteType: string;
                    summary: string;
                    language: string;
                    date: string | null;
                    sentiment: import("@repo/auto-extract").NoteSentiment;
                    emotions: {
                        emotion: string;
                        intensity: 1 | 2 | 3 | 4 | 5;
                    }[];
                    entities: {
                        id: string;
                        name: string;
                        type: import("@repo/auto-extract").EntityType;
                        nameStart: number;
                        nameEnd: number;
                        evidenceStart?: number | undefined | undefined;
                        evidenceEnd?: number | undefined | undefined;
                        context?: string | undefined | undefined;
                        confidence: number;
                    }[];
                    facts: {
                        id: string;
                        ownerEntityId: string;
                        perspective: import("@repo/auto-extract").FactPerspective;
                        segmentId?: string | undefined | undefined;
                        subjectEntityId?: string | undefined | undefined;
                        predicate: string;
                        objectEntityId?: string | undefined | undefined;
                        objectText?: string | undefined | undefined;
                        evidenceStart: number;
                        evidenceEnd: number;
                        confidence: number;
                    }[];
                    relations: {
                        fromEntityId: string;
                        toEntityId: string;
                        type: string;
                        evidenceStart?: number | undefined | undefined;
                        evidenceEnd?: number | undefined | undefined;
                        confidence: number;
                    }[];
                    todos: {
                        id: string;
                        description: string;
                        assigneeEntityId?: string | undefined | undefined;
                        evidenceStart: number;
                        evidenceEnd: number;
                        confidence: number;
                    }[];
                    groups: {
                        name: string;
                        entityIds: string[];
                        factIds: string[];
                    }[];
                    segments: {
                        id: string;
                        start: number;
                        end: number;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        summary: string;
                        entityIds: string[];
                        factIds: string[];
                        relationIndexes: number[];
                    }[];
                };
                debug: {
                    inputText: string;
                    prompt: string;
                    rawModelOutput: string;
                    validatedExtractionBeforeSegmentation: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    finalExtraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    segmentationTrace: {
                        segmentId: string;
                        start: number;
                        end: number;
                        reason: string;
                    }[];
                    runtime: {
                        modelPath: string;
                        serverMode: "metal" | "cpu";
                        nPredict: number;
                        totalMs: number;
                    };
                    fallbackUsed: boolean;
                    errors: string[];
                };
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/list": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                history: {
                    id: string;
                    sourceText: string;
                    prompt: string;
                    extraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    debug: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    };
                    compareLanes?: {
                        laneId: ExtractionLaneId;
                        provider: "google" | "anthropic" | "openai";
                        model: string;
                        status: "ok" | "error" | "skipped";
                        durationMs: number;
                        extraction?: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        } | undefined;
                        debug?: {
                            inputText: string;
                            prompt: string;
                            rawModelOutput: string;
                            validatedExtractionBeforeSegmentation: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            finalExtraction: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            segmentationTrace: {
                                segmentId: string;
                                start: number;
                                end: number;
                                reason: string;
                            }[];
                            runtime: {
                                modelPath: string;
                                serverMode: "metal" | "cpu";
                                nPredict: number;
                                totalMs: number;
                            };
                            fallbackUsed: boolean;
                            errors: string[];
                        } | undefined;
                        errorMessage?: string | undefined | undefined;
                    }[] | undefined;
                    createdAt: string;
                }[];
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/get/:id": {
        $get: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 400;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 404;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: true;
                entry: {
                    id: string;
                    sourceText: string;
                    prompt: string;
                    extraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    debug: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    };
                    compareLanes?: {
                        laneId: ExtractionLaneId;
                        provider: "google" | "anthropic" | "openai";
                        model: string;
                        status: "ok" | "error" | "skipped";
                        durationMs: number;
                        extraction?: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        } | undefined;
                        debug?: {
                            inputText: string;
                            prompt: string;
                            rawModelOutput: string;
                            validatedExtractionBeforeSegmentation: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            finalExtraction: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            segmentationTrace: {
                                segmentId: string;
                                start: number;
                                end: number;
                                reason: string;
                            }[];
                            runtime: {
                                modelPath: string;
                                serverMode: "metal" | "cpu";
                                nPredict: number;
                                totalMs: number;
                            };
                            fallbackUsed: boolean;
                            errors: string[];
                        } | undefined;
                        errorMessage?: string | undefined | undefined;
                    }[] | undefined;
                    createdAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/compareLane": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                lane: {
                    laneId: ExtractionLaneId;
                    provider: "google" | "anthropic" | "openai";
                    model: string;
                    status: "ok" | "error" | "skipped";
                    durationMs: number;
                    extraction?: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    } | undefined;
                    debug?: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    } | undefined;
                    errorMessage?: string | undefined | undefined;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/saveCompare": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                success: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/extract/history/saveCompare">;
declare const appForType: import("hono/hono-base").HonoBase<Env, {
    "/api/health": {
        $get: {
            input: {};
            output: {
                status: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/auth/google": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 500;
        } | {
            input: {};
            output: undefined;
            outputFormat: "redirect";
            status: 302;
        };
    };
} & {
    "/api/auth/google/callback": {
        $get: {
            input: {};
            output: undefined;
            outputFormat: "redirect";
            status: 302;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 400;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 500;
        };
    };
} & {
    "/api/auth/mock-login": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 404;
        } | {
            input: {};
            output: {
                ok: true;
                user: {
                    id: string;
                    googleId: string;
                    email: string;
                    createdAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/auth/me": {
        $get: {
            input: {};
            output: {
                ok: true;
                user: {
                    id: string;
                    email: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        };
    };
} & {
    "/api/auth/logout": {
        $post: {
            input: {};
            output: {
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/notes/list": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                notes: {
                    id: string;
                    title: string;
                    body: string | null;
                    createdAt: string;
                    updatedAt: string;
                }[];
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/notes/create": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                note: {
                    id: string;
                    title: string;
                    body: string | null;
                    createdAt: string;
                    updatedAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/run": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                extraction: {
                    title: string;
                    noteType: string;
                    summary: string;
                    language: string;
                    date: string | null;
                    sentiment: import("@repo/auto-extract").NoteSentiment;
                    emotions: {
                        emotion: string;
                        intensity: 1 | 2 | 3 | 4 | 5;
                    }[];
                    entities: {
                        id: string;
                        name: string;
                        type: import("@repo/auto-extract").EntityType;
                        nameStart: number;
                        nameEnd: number;
                        evidenceStart?: number | undefined | undefined;
                        evidenceEnd?: number | undefined | undefined;
                        context?: string | undefined | undefined;
                        confidence: number;
                    }[];
                    facts: {
                        id: string;
                        ownerEntityId: string;
                        perspective: import("@repo/auto-extract").FactPerspective;
                        segmentId?: string | undefined | undefined;
                        subjectEntityId?: string | undefined | undefined;
                        predicate: string;
                        objectEntityId?: string | undefined | undefined;
                        objectText?: string | undefined | undefined;
                        evidenceStart: number;
                        evidenceEnd: number;
                        confidence: number;
                    }[];
                    relations: {
                        fromEntityId: string;
                        toEntityId: string;
                        type: string;
                        evidenceStart?: number | undefined | undefined;
                        evidenceEnd?: number | undefined | undefined;
                        confidence: number;
                    }[];
                    todos: {
                        id: string;
                        description: string;
                        assigneeEntityId?: string | undefined | undefined;
                        evidenceStart: number;
                        evidenceEnd: number;
                        confidence: number;
                    }[];
                    groups: {
                        name: string;
                        entityIds: string[];
                        factIds: string[];
                    }[];
                    segments: {
                        id: string;
                        start: number;
                        end: number;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        summary: string;
                        entityIds: string[];
                        factIds: string[];
                        relationIndexes: number[];
                    }[];
                };
                debug: {
                    inputText: string;
                    prompt: string;
                    rawModelOutput: string;
                    validatedExtractionBeforeSegmentation: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    finalExtraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    segmentationTrace: {
                        segmentId: string;
                        start: number;
                        end: number;
                        reason: string;
                    }[];
                    runtime: {
                        modelPath: string;
                        serverMode: "metal" | "cpu";
                        nPredict: number;
                        totalMs: number;
                    };
                    fallbackUsed: boolean;
                    errors: string[];
                };
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/list": {
        $get: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                history: {
                    id: string;
                    sourceText: string;
                    prompt: string;
                    extraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    debug: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    };
                    compareLanes?: {
                        laneId: ExtractionLaneId;
                        provider: "google" | "anthropic" | "openai";
                        model: string;
                        status: "ok" | "error" | "skipped";
                        durationMs: number;
                        extraction?: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        } | undefined;
                        debug?: {
                            inputText: string;
                            prompt: string;
                            rawModelOutput: string;
                            validatedExtractionBeforeSegmentation: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            finalExtraction: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            segmentationTrace: {
                                segmentId: string;
                                start: number;
                                end: number;
                                reason: string;
                            }[];
                            runtime: {
                                modelPath: string;
                                serverMode: "metal" | "cpu";
                                nPredict: number;
                                totalMs: number;
                            };
                            fallbackUsed: boolean;
                            errors: string[];
                        } | undefined;
                        errorMessage?: string | undefined | undefined;
                    }[] | undefined;
                    createdAt: string;
                }[];
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/get/:id": {
        $get: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 400;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 404;
        } | {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: true;
                entry: {
                    id: string;
                    sourceText: string;
                    prompt: string;
                    extraction: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    };
                    debug: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    };
                    compareLanes?: {
                        laneId: ExtractionLaneId;
                        provider: "google" | "anthropic" | "openai";
                        model: string;
                        status: "ok" | "error" | "skipped";
                        durationMs: number;
                        extraction?: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        } | undefined;
                        debug?: {
                            inputText: string;
                            prompt: string;
                            rawModelOutput: string;
                            validatedExtractionBeforeSegmentation: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            finalExtraction: {
                                title: string;
                                noteType: string;
                                summary: string;
                                language: string;
                                date: string | null;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                emotions: {
                                    emotion: string;
                                    intensity: 1 | 2 | 3 | 4 | 5;
                                }[];
                                entities: {
                                    id: string;
                                    name: string;
                                    type: import("@repo/auto-extract").EntityType;
                                    nameStart: number;
                                    nameEnd: number;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    context?: string | undefined | undefined;
                                    confidence: number;
                                }[];
                                facts: {
                                    id: string;
                                    ownerEntityId: string;
                                    perspective: import("@repo/auto-extract").FactPerspective;
                                    segmentId?: string | undefined | undefined;
                                    subjectEntityId?: string | undefined | undefined;
                                    predicate: string;
                                    objectEntityId?: string | undefined | undefined;
                                    objectText?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                relations: {
                                    fromEntityId: string;
                                    toEntityId: string;
                                    type: string;
                                    evidenceStart?: number | undefined | undefined;
                                    evidenceEnd?: number | undefined | undefined;
                                    confidence: number;
                                }[];
                                todos: {
                                    id: string;
                                    description: string;
                                    assigneeEntityId?: string | undefined | undefined;
                                    evidenceStart: number;
                                    evidenceEnd: number;
                                    confidence: number;
                                }[];
                                groups: {
                                    name: string;
                                    entityIds: string[];
                                    factIds: string[];
                                }[];
                                segments: {
                                    id: string;
                                    start: number;
                                    end: number;
                                    sentiment: import("@repo/auto-extract").NoteSentiment;
                                    summary: string;
                                    entityIds: string[];
                                    factIds: string[];
                                    relationIndexes: number[];
                                }[];
                            };
                            segmentationTrace: {
                                segmentId: string;
                                start: number;
                                end: number;
                                reason: string;
                            }[];
                            runtime: {
                                modelPath: string;
                                serverMode: "metal" | "cpu";
                                nPredict: number;
                                totalMs: number;
                            };
                            fallbackUsed: boolean;
                            errors: string[];
                        } | undefined;
                        errorMessage?: string | undefined | undefined;
                    }[] | undefined;
                    createdAt: string;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/compareLane": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                lane: {
                    laneId: ExtractionLaneId;
                    provider: "google" | "anthropic" | "openai";
                    model: string;
                    status: "ok" | "error" | "skipped";
                    durationMs: number;
                    extraction?: {
                        title: string;
                        noteType: string;
                        summary: string;
                        language: string;
                        date: string | null;
                        sentiment: import("@repo/auto-extract").NoteSentiment;
                        emotions: {
                            emotion: string;
                            intensity: 1 | 2 | 3 | 4 | 5;
                        }[];
                        entities: {
                            id: string;
                            name: string;
                            type: import("@repo/auto-extract").EntityType;
                            nameStart: number;
                            nameEnd: number;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            context?: string | undefined | undefined;
                            confidence: number;
                        }[];
                        facts: {
                            id: string;
                            ownerEntityId: string;
                            perspective: import("@repo/auto-extract").FactPerspective;
                            segmentId?: string | undefined | undefined;
                            subjectEntityId?: string | undefined | undefined;
                            predicate: string;
                            objectEntityId?: string | undefined | undefined;
                            objectText?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        relations: {
                            fromEntityId: string;
                            toEntityId: string;
                            type: string;
                            evidenceStart?: number | undefined | undefined;
                            evidenceEnd?: number | undefined | undefined;
                            confidence: number;
                        }[];
                        todos: {
                            id: string;
                            description: string;
                            assigneeEntityId?: string | undefined | undefined;
                            evidenceStart: number;
                            evidenceEnd: number;
                            confidence: number;
                        }[];
                        groups: {
                            name: string;
                            entityIds: string[];
                            factIds: string[];
                        }[];
                        segments: {
                            id: string;
                            start: number;
                            end: number;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            summary: string;
                            entityIds: string[];
                            factIds: string[];
                            relationIndexes: number[];
                        }[];
                    } | undefined;
                    debug?: {
                        inputText: string;
                        prompt: string;
                        rawModelOutput: string;
                        validatedExtractionBeforeSegmentation: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        finalExtraction: {
                            title: string;
                            noteType: string;
                            summary: string;
                            language: string;
                            date: string | null;
                            sentiment: import("@repo/auto-extract").NoteSentiment;
                            emotions: {
                                emotion: string;
                                intensity: 1 | 2 | 3 | 4 | 5;
                            }[];
                            entities: {
                                id: string;
                                name: string;
                                type: import("@repo/auto-extract").EntityType;
                                nameStart: number;
                                nameEnd: number;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                context?: string | undefined | undefined;
                                confidence: number;
                            }[];
                            facts: {
                                id: string;
                                ownerEntityId: string;
                                perspective: import("@repo/auto-extract").FactPerspective;
                                segmentId?: string | undefined | undefined;
                                subjectEntityId?: string | undefined | undefined;
                                predicate: string;
                                objectEntityId?: string | undefined | undefined;
                                objectText?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            relations: {
                                fromEntityId: string;
                                toEntityId: string;
                                type: string;
                                evidenceStart?: number | undefined | undefined;
                                evidenceEnd?: number | undefined | undefined;
                                confidence: number;
                            }[];
                            todos: {
                                id: string;
                                description: string;
                                assigneeEntityId?: string | undefined | undefined;
                                evidenceStart: number;
                                evidenceEnd: number;
                                confidence: number;
                            }[];
                            groups: {
                                name: string;
                                entityIds: string[];
                                factIds: string[];
                            }[];
                            segments: {
                                id: string;
                                start: number;
                                end: number;
                                sentiment: import("@repo/auto-extract").NoteSentiment;
                                summary: string;
                                entityIds: string[];
                                factIds: string[];
                                relationIndexes: number[];
                            }[];
                        };
                        segmentationTrace: {
                            segmentId: string;
                            start: number;
                            end: number;
                            reason: string;
                        }[];
                        runtime: {
                            modelPath: string;
                            serverMode: "metal" | "cpu";
                            nPredict: number;
                            totalMs: number;
                        };
                        fallbackUsed: boolean;
                        errors: string[];
                    } | undefined;
                    errorMessage?: string | undefined | undefined;
                };
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/extract/history/saveCompare": {
        $post: {
            input: {};
            output: {
                ok: false;
                error: string;
            };
            outputFormat: "json";
            status: 401;
        } | {
            input: {};
            output: {
                ok: true;
                success: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/extract/history/saveCompare">;
export type AppType = typeof appForType;
export {};
//# sourceMappingURL=app.d.ts.map
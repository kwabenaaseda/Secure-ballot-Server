// Over the network
export interface General_Error_Handler {
    err_message: string
    success:false
    guidelines: string    

}

export interface General_Success_Handler {
    success_message: string
    sucess: true
    data : object
}

// Internals

export interface Service_Success_Handler {
    _OPS_STATS : "COMPLETED" | "PENDING"
    _OPS_META : {
        _timestamp: string,
        _event: string,
        _source: string
    }
    _OPS_DATA ?:object
    success: true
    _OPS_MESSAGE: string
}

export interface Service_Error_Handler {
    _OPS_STATS : "OPERATION FAILURE" | "SYSTEM FAILURE"
    _OPS_META : {
        _timestamp: string,
        _event: string,
        _source: string
    }
    _OPS_DATA ?:object
    success: false
    _OPS_MESSAGE: string
}
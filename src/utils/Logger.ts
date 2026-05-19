export function CLOCK(){
    const time = new Date
    return `TimeStamp: ${time.getHours()}-${time.getMinutes()}-${time.getSeconds()}-${time.getMilliseconds()} | ${time.getDate()}-${time.getMonth()}-${time.getFullYear()}`
}

export const Logger = {
    Log : (severity: string, source: string,  message: string | undefined | Error, Event:String)=>{
        const struct = `
        ${CLOCK()}
        ----------------------->> ${severity} <<-----------------------
        Source : ${source}
        ------------------------------||-------------------------------
        ${Event} EVENT
                                --------------
        MESSAGE: ${message}

        ---------------------------------------------------------------
        SOURCE is at ${source} function
        `
        return console.log(struct)
    },
}
export const Log = {
    warn : (source:string, message:string,event:String)=>{
        Logger.Log("WARNING",source,message, event)
    },
    info: (source:string, message:string, event:String)=>{
        Logger.Log("INFORMATION",source,message, event)
    },
    debug: (source:string, message:string,event:String)=>{
        Logger.Log("DEBUGING",source,message,event)
    },
    guide: (source:string, message:string,event:String)=>{
        Logger.Log("GUIDE-LINES",source,message,event)
    }

}
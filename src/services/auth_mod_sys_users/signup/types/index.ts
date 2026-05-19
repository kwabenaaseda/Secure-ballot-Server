export interface SignupPayload {
    // Identity
    username: string

    // Contact
    email: string
    telephone: string

    // Security
    password: string

    // Optional profile bootstrap
    date_of_birth: string
    nationality_code: string
    occupation: string
}
package com.chronosabc.security

import org.mindrot.jbcrypt.BCrypt

object PasswordHasher {

    fun hash(plain: String): String {
        return BCrypt.hashpw(plain, BCrypt.gensalt())
    }

    fun verify(plain: String, hash: String): Boolean {
        return BCrypt.checkpw(plain, hash)
    }
}

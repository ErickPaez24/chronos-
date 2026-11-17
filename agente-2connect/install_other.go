//go:build !windows

package main

import "errors"

// Solo para compilar/probar fuera de Windows.
func beepOK()   {}
func beepFail() {}

func install() error   { return errors.New("la instalación solo funciona en Windows") }
func uninstall() error { return errors.New("la instalación solo funciona en Windows") }

<script setup lang="ts">
const { user } = useAuth()
const { start, stop, syncPushState } = useNotifications()

watch(user, (currentUser) => {
  if (currentUser) {
    void start()
    void syncPushState()
  }
  else stop()
}, { immediate: true })

onBeforeUnmount(stop)
</script>

<template />

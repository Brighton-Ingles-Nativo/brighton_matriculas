<script setup lang="ts">
const { user } = useAuth()
const { start, stop } = useNotifications()

watch(user, (currentUser) => {
  if (currentUser) void start()
  else stop()
}, { immediate: true })

onBeforeUnmount(stop)
</script>

<template />
